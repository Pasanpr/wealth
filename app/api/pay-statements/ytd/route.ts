import { NextRequest, NextResponse } from 'next/server'
import { getYtdSummary } from '@/lib/services/pay-statement'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')
    const asOfDate = searchParams.get('asOfDate') ?? undefined

    const year = yearParam
      ? parseInt(yearParam, 10)
      : new Date().getFullYear()

    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }

    const summary = getYtdSummary(year, asOfDate)
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Failed to fetch YTD summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch YTD summary' },
      { status: 500 }
    )
  }
}
