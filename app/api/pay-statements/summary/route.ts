import { NextRequest, NextResponse } from 'next/server'
import {
  getAnnualSummary,
  getPayStatementYears,
} from '@/lib/services/pay-statement'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')

    // If year specified, return just that year's summary
    if (yearParam) {
      const year = parseInt(yearParam, 10)
      if (isNaN(year)) {
        return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
      }
      const summary = getAnnualSummary(year)
      return NextResponse.json(summary)
    }

    // Otherwise return summaries for all years
    const years = getPayStatementYears()
    const summaries = years.map(year => getAnnualSummary(year))

    return NextResponse.json({ years, summaries })
  } catch (error) {
    console.error('Failed to fetch pay statement summary:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay statement summary' },
      { status: 500 }
    )
  }
}
