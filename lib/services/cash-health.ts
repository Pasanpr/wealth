import { getDb } from '@/lib/db'
import { CashHealthMetrics, CashBalance, YearlyExpense } from '@/lib/types'

export interface IncomeMetrics {
  averageNetPay: number
  expectedMonthlyIncome: number
  payFrequency: 'biweekly' | 'semimonthly' | 'monthly' | 'unknown'
  paychecksPerMonth: number
  incomeVsExpenses: number // ratio > 1 means income exceeds expenses
  ytdSalaryIncome: number
  ytdTotalIncome: number
  lastPayDate: string | null
  paycheckCount: number
}

export function calculateCashHealth(): CashHealthMetrics {
  const db = getDb()

  // Get latest cash balance per account
  const latestBalances = db.prepare(`
    SELECT cb1.*
    FROM cash_balances cb1
    INNER JOIN (
      SELECT account_name, MAX(date) as max_date
      FROM cash_balances
      GROUP BY account_name
    ) cb2 ON cb1.account_name = cb2.account_name AND cb1.date = cb2.max_date
  `).all() as CashBalance[]

  const totalCash = latestBalances.reduce((sum, b) => sum + b.balance, 0)

  // Get yearly expenses for average calculation
  const expenses = db.prepare(`
    SELECT * FROM yearly_expenses
    ORDER BY year DESC
    LIMIT 3
  `).all() as YearlyExpense[]

  let monthlyExpenseAverage = 0
  if (expenses.length > 0) {
    const totalExpenses = expenses.reduce((sum, e) => sum + e.total_amount, 0)
    const monthCount = expenses.length * 12
    monthlyExpenseAverage = totalExpenses / monthCount
  }

  // Get target months from settings
  const targetSetting = db.prepare(`SELECT value FROM settings WHERE key = 'cash_reserve_months'`).get() as { value: string } | undefined
  const targetMonths = targetSetting ? parseInt(targetSetting.value) : 6

  const monthsCovered = monthlyExpenseAverage > 0 ? totalCash / monthlyExpenseAverage : 0

  let status: 'healthy' | 'warning' | 'critical' = 'healthy'
  if (monthsCovered < targetMonths * 0.5) {
    status = 'critical'
  } else if (monthsCovered < targetMonths) {
    status = 'warning'
  }

  return {
    totalCash,
    monthlyExpenseAverage,
    monthsCovered,
    targetMonths,
    status,
  }
}

export function getExpenseCoverage(): { months: number; amount: number; coverage: number }[] {
  const db = getDb()

  // Get latest cash balance per account
  const latestBalances = db.prepare(`
    SELECT cb1.*
    FROM cash_balances cb1
    INNER JOIN (
      SELECT account_name, MAX(date) as max_date
      FROM cash_balances
      GROUP BY account_name
    ) cb2 ON cb1.account_name = cb2.account_name AND cb1.date = cb2.max_date
  `).all() as CashBalance[]

  const totalCash = latestBalances.reduce((sum, b) => sum + b.balance, 0)

  // Get yearly expenses
  const expenses = db.prepare(`
    SELECT * FROM yearly_expenses
    ORDER BY year DESC
    LIMIT 3
  `).all() as YearlyExpense[]

  if (expenses.length === 0) {
    return [
      { months: 1, amount: 0, coverage: 0 },
      { months: 3, amount: 0, coverage: 0 },
      { months: 6, amount: 0, coverage: 0 },
    ]
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.total_amount, 0)
  const monthCount = expenses.length * 12
  const monthlyAverage = totalExpenses / monthCount

  return [
    { months: 1, amount: monthlyAverage, coverage: totalCash / monthlyAverage },
    { months: 3, amount: monthlyAverage * 3, coverage: totalCash / (monthlyAverage * 3) },
    { months: 6, amount: monthlyAverage * 6, coverage: totalCash / (monthlyAverage * 6) },
  ]
}

/**
 * Calculate income metrics from pay statements and income records
 */
export function getIncomeMetrics(): IncomeMetrics {
  const db = getDb()
  const currentYear = new Date().getFullYear()

  // Get pay statements for current year to calculate average net pay
  const payStatements = db
    .prepare(
      `SELECT id, pay_date, net_pay
       FROM pay_statements
       WHERE strftime('%Y', pay_date) = ?
       ORDER BY pay_date DESC`
    )
    .all(String(currentYear)) as { id: number; pay_date: string; net_pay: number }[]

  // Calculate average net pay
  const averageNetPay =
    payStatements.length > 0
      ? payStatements.reduce((sum, p) => sum + p.net_pay, 0) / payStatements.length
      : 0

  // Determine pay frequency by analyzing gaps between pay dates
  const payFrequency = detectPayFrequency(payStatements.map(p => p.pay_date))
  const paychecksPerMonth = getPaychecksPerMonth(payFrequency)

  // Expected monthly income = average net pay * paychecks per month
  const expectedMonthlyIncome = averageNetPay * paychecksPerMonth

  // Get monthly expense average for comparison
  const expenses = db
    .prepare(
      `SELECT * FROM yearly_expenses
       ORDER BY year DESC
       LIMIT 3`
    )
    .all() as YearlyExpense[]

  let monthlyExpenseAverage = 0
  if (expenses.length > 0) {
    const totalExpenses = expenses.reduce((sum, e) => sum + e.total_amount, 0)
    monthlyExpenseAverage = totalExpenses / (expenses.length * 12)
  }

  // Income vs expenses ratio
  const incomeVsExpenses =
    monthlyExpenseAverage > 0 ? expectedMonthlyIncome / monthlyExpenseAverage : 0

  // Get YTD income from synced income records
  const ytdIncome = db
    .prepare(
      `SELECT income_type, SUM(amount) as total
       FROM income_records
       WHERE strftime('%Y', date) = ?
       GROUP BY income_type`
    )
    .all(String(currentYear)) as { income_type: string; total: number }[]

  const ytdSalaryIncome = ytdIncome.find(i => i.income_type === 'salary')?.total ?? 0
  const ytdTotalIncome = ytdIncome.reduce((sum, i) => sum + i.total, 0)

  return {
    averageNetPay,
    expectedMonthlyIncome,
    payFrequency,
    paychecksPerMonth,
    incomeVsExpenses,
    ytdSalaryIncome,
    ytdTotalIncome,
    lastPayDate: payStatements[0]?.pay_date ?? null,
    paycheckCount: payStatements.length,
  }
}

/**
 * Detect pay frequency from pay dates
 */
function detectPayFrequency(
  payDates: string[]
): 'biweekly' | 'semimonthly' | 'monthly' | 'unknown' {
  if (payDates.length < 2) return 'unknown'

  // Calculate average days between paychecks
  const sortedDates = [...payDates].sort()
  const gaps: number[] = []

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1])
    const curr = new Date(sortedDates[i])
    const daysDiff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24))
    gaps.push(daysDiff)
  }

  const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length

  // Biweekly: ~14 days, Semimonthly: ~15 days, Monthly: ~30 days
  if (avgGap >= 12 && avgGap <= 16) {
    // Check if it's truly biweekly (14 days) or semimonthly (15th and end of month)
    // Semimonthly tends to have more variation in gaps
    const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length
    return variance > 4 ? 'semimonthly' : 'biweekly'
  } else if (avgGap >= 28 && avgGap <= 32) {
    return 'monthly'
  }

  return 'unknown'
}

/**
 * Get number of paychecks per month based on pay frequency
 */
function getPaychecksPerMonth(frequency: 'biweekly' | 'semimonthly' | 'monthly' | 'unknown'): number {
  switch (frequency) {
    case 'biweekly':
      return 26 / 12 // ~2.17 paychecks per month
    case 'semimonthly':
      return 2
    case 'monthly':
      return 1
    default:
      return 2 // Default to assuming 2 per month
  }
}
