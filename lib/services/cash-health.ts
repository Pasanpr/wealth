import { getDb } from '@/lib/db'
import { CashHealthMetrics, CashBalance, YearlyExpense } from '@/lib/types'

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
