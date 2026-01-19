import { getDb } from '@/lib/db'
import { SpendingStats, MonthlySpending, YoYComparison } from '@/lib/types'

interface MonthlyTotal {
  year: number
  month: number
  total: number
}

export function getMonthlyTotals(year?: number): MonthlyTotal[] {
  const db = getDb()

  let query = `
    SELECT year, month, SUM(amount) as total
    FROM credit_card_spending
  `
  const params: number[] = []

  if (year) {
    query += ' WHERE year = ?'
    params.push(year)
  }

  query += ' GROUP BY year, month ORDER BY year DESC, month DESC'

  return db.prepare(query).all(...params) as MonthlyTotal[]
}

export function calculateSpendingStats(year?: number): SpendingStats {
  const totals = getMonthlyTotals(year)

  if (totals.length === 0) {
    return {
      average: 0,
      median: 0,
      min: 0,
      max: 0,
      total: 0,
      count: 0,
    }
  }

  const amounts = totals.map(t => t.total)
  const sorted = [...amounts].sort((a, b) => a - b)

  const sum = amounts.reduce((a, b) => a + b, 0)
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)]

  return {
    average: sum / amounts.length,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    total: sum,
    count: amounts.length,
  }
}

export function getYearOverYearComparison(currentYear: number): YoYComparison[] {
  const db = getDb()
  const previousYear = currentYear - 1

  const currentData = db.prepare(`
    SELECT month, SUM(amount) as total
    FROM credit_card_spending
    WHERE year = ?
    GROUP BY month
    ORDER BY month
  `).all(currentYear) as { month: number; total: number }[]

  const previousData = db.prepare(`
    SELECT month, SUM(amount) as total
    FROM credit_card_spending
    WHERE year = ?
    GROUP BY month
    ORDER BY month
  `).all(previousYear) as { month: number; total: number }[]

  const previousMap = new Map(previousData.map(d => [d.month, d.total]))

  const comparisons: YoYComparison[] = []

  for (let month = 1; month <= 12; month++) {
    const currentMonthData = currentData.find(d => d.month === month)
    const currentAmount = currentMonthData?.total || 0
    const previousAmount = previousMap.get(month) || 0

    const change = currentAmount - previousAmount
    const changePercent = previousAmount > 0 ? (change / previousAmount) : 0

    comparisons.push({
      month,
      currentYear: currentAmount,
      previousYear: previousAmount,
      change,
      changePercent,
    })
  }

  return comparisons
}

export function getSpendingTrend(months: number = 12): MonthlySpending[] {
  const db = getDb()

  const results = db.prepare(`
    SELECT year, month, SUM(amount) as amount
    FROM credit_card_spending
    GROUP BY year, month
    ORDER BY year DESC, month DESC
    LIMIT ?
  `).all(months) as MonthlySpending[]

  return results.reverse()
}
