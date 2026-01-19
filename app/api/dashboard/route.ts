import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { calculateCashHealth } from '@/lib/services/cash-health'
import { calculateSpendingStats } from '@/lib/services/spending-analysis'
import { calculateAllocation } from '@/lib/services/rebalancing'

export async function GET() {
  try {
    const db = getDb()

    // Cash health
    const cashHealth = calculateCashHealth()

    // Current month spending
    const currentDate = new Date()
    const currentYear = currentDate.getFullYear()
    const currentMonth = currentDate.getMonth() + 1

    const currentMonthSpending = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM credit_card_spending
      WHERE year = ? AND month = ?
    `).get(currentYear, currentMonth) as { total: number }

    // Spending stats
    const spendingStats = calculateSpendingStats()

    // Portfolio value
    const allocation = calculateAllocation()

    // YTD return placeholder (would need holdings history to calculate)
    const ytdReturn = null

    return NextResponse.json({
      cash: {
        totalCash: cashHealth.totalCash,
        monthsCovered: cashHealth.monthsCovered,
        status: cashHealth.status,
      },
      spending: {
        currentMonth: currentMonthSpending.total,
        monthlyAverage: spendingStats.average,
      },
      portfolio: {
        totalValue: allocation.totalValue,
        needsRebalancing: allocation.needsRebalancing,
      },
      ytdReturn,
    })
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 })
  }
}
