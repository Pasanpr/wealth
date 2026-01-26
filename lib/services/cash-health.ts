import { getDb } from '@/lib/db'
import { CashHealthMetrics } from '@/lib/types'

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

  // Get latest cash balance per account from monthly_cash_balances
  const latestBalances = db.prepare(`
    SELECT mcb.cash_account_id, mcb.balance, mcb.year, mcb.month
    FROM monthly_cash_balances mcb
    INNER JOIN cash_accounts ca ON mcb.cash_account_id = ca.id AND ca.is_active = 1
    INNER JOIN (
      SELECT cash_account_id, MAX(year * 100 + month) as max_period
      FROM monthly_cash_balances
      GROUP BY cash_account_id
    ) latest ON mcb.cash_account_id = latest.cash_account_id
      AND (mcb.year * 100 + mcb.month) = latest.max_period
  `).all() as { cash_account_id: number; balance: number; year: number; month: number }[]

  const totalCash = latestBalances.reduce((sum, b) => sum + b.balance, 0)

  // Calculate monthly expense average from credit card spending
  const spendingData = db.prepare(`
    SELECT year, month, SUM(amount) as total
    FROM credit_card_spending
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `).all() as { year: number; month: number; total: number }[]

  let monthlyExpenseAverage = 0
  if (spendingData.length > 0) {
    const totalSpending = spendingData.reduce((sum, s) => sum + s.total, 0)
    monthlyExpenseAverage = totalSpending / spendingData.length
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

  // Get latest cash balance per account from monthly_cash_balances
  const latestBalances = db.prepare(`
    SELECT mcb.cash_account_id, mcb.balance, mcb.year, mcb.month
    FROM monthly_cash_balances mcb
    INNER JOIN cash_accounts ca ON mcb.cash_account_id = ca.id AND ca.is_active = 1
    INNER JOIN (
      SELECT cash_account_id, MAX(year * 100 + month) as max_period
      FROM monthly_cash_balances
      GROUP BY cash_account_id
    ) latest ON mcb.cash_account_id = latest.cash_account_id
      AND (mcb.year * 100 + mcb.month) = latest.max_period
  `).all() as { cash_account_id: number; balance: number; year: number; month: number }[]

  const totalCash = latestBalances.reduce((sum, b) => sum + b.balance, 0)

  // Calculate monthly expense average from credit card spending
  const spendingData = db.prepare(`
    SELECT year, month, SUM(amount) as total
    FROM credit_card_spending
    GROUP BY year, month
    ORDER BY year DESC, month DESC
  `).all() as { year: number; month: number; total: number }[]

  if (spendingData.length === 0) {
    return [
      { months: 1, amount: 0, coverage: 0 },
      { months: 3, amount: 0, coverage: 0 },
      { months: 6, amount: 0, coverage: 0 },
    ]
  }

  const totalSpending = spendingData.reduce((sum, s) => sum + s.total, 0)
  const monthlyAverage = totalSpending / spendingData.length

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

  // Get monthly expense average from credit card spending
  const spendingData = db
    .prepare(
      `SELECT year, month, SUM(amount) as total
       FROM credit_card_spending
       GROUP BY year, month`
    )
    .all() as { year: number; month: number; total: number }[]

  let monthlyExpenseAverage = 0
  if (spendingData.length > 0) {
    const totalSpending = spendingData.reduce((sum, s) => sum + s.total, 0)
    monthlyExpenseAverage = totalSpending / spendingData.length
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
