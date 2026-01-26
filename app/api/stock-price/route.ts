import { NextRequest, NextResponse } from 'next/server'

interface YahooQuoteResponse {
  chart: {
    result: Array<{
      meta: {
        regularMarketPrice: number
        previousClose: number
        symbol: string
        exchangeName: string
        currency: string
      }
    }>
    error: null | { code: string; description: string }
  }
}

// Cache price for 5 minutes to avoid rate limiting
let cachedPrice: { price: number; timestamp: number; symbol: string } | null = null
const CACHE_DURATION_MS = 5 * 60 * 1000

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'INTU'

  // Check cache
  if (
    cachedPrice &&
    cachedPrice.symbol === symbol &&
    Date.now() - cachedPrice.timestamp < CACHE_DURATION_MS
  ) {
    return NextResponse.json({
      symbol,
      price: cachedPrice.price,
      cached: true,
      cachedAt: new Date(cachedPrice.timestamp).toISOString(),
    })
  }

  try {
    // Use Yahoo Finance chart API (more reliable than quote API)
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    })

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`)
    }

    const data = (await response.json()) as YahooQuoteResponse

    if (data.chart.error) {
      throw new Error(data.chart.error.description)
    }

    const result = data.chart.result?.[0]
    if (!result?.meta?.regularMarketPrice) {
      throw new Error('No price data available')
    }

    const price = result.meta.regularMarketPrice
    const previousClose = result.meta.previousClose

    // Update cache
    cachedPrice = { price, timestamp: Date.now(), symbol }

    return NextResponse.json({
      symbol,
      price,
      previousClose,
      change: price - previousClose,
      changePercent: ((price - previousClose) / previousClose) * 100,
      exchange: result.meta.exchangeName,
      currency: result.meta.currency,
      cached: false,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to fetch stock price:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stock price',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
