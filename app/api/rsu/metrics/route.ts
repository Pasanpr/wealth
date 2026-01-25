import { NextRequest, NextResponse } from 'next/server'
import { getRsuMetrics, getHistoricalTaxRates, getReinvestmentSummary } from '@/lib/services/rsu'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const stockPrice = searchParams.get('stockPrice')

    const metrics = getRsuMetrics(stockPrice ? parseFloat(stockPrice) : undefined)
    const historicalTaxRates = getHistoricalTaxRates()
    const reinvestmentSummary = getReinvestmentSummary()

    return NextResponse.json({
      metrics,
      historicalTaxRates,
      reinvestmentSummary,
    })
  } catch (error) {
    console.error('Failed to calculate RSU metrics:', error)
    return NextResponse.json({ error: 'Failed to calculate RSU metrics' }, { status: 500 })
  }
}
