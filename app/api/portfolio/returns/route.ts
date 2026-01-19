import { NextRequest, NextResponse } from 'next/server'
import { getPortfolioReturns } from '@/lib/services/returns'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const returns = getPortfolioReturns(
      accountId ? parseInt(accountId) : undefined,
      startDate || undefined,
      endDate || undefined
    )

    if (!returns) {
      return NextResponse.json({
        error: 'Insufficient data to calculate returns. Need at least 2 portfolio snapshots.'
      }, { status: 400 })
    }

    return NextResponse.json(returns)
  } catch (error) {
    console.error('Failed to calculate returns:', error)
    return NextResponse.json({ error: 'Failed to calculate returns' }, { status: 500 })
  }
}
