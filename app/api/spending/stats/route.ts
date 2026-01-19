import { NextRequest, NextResponse } from 'next/server'
import {
  calculateSpendingStats,
  getYearOverYearComparison,
  getSpendingTrend,
} from '@/lib/services/spending-analysis'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const currentYear = year ? parseInt(year) : new Date().getFullYear()

    const stats = calculateSpendingStats(year ? parseInt(year) : undefined)
    const yoyComparison = getYearOverYearComparison(currentYear)
    const trend = getSpendingTrend(24)

    return NextResponse.json({
      stats,
      yoyComparison,
      trend,
    })
  } catch (error) {
    console.error('Failed to calculate spending stats:', error)
    return NextResponse.json({ error: 'Failed to calculate spending stats' }, { status: 500 })
  }
}
