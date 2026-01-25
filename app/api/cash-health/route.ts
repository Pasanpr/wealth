import { NextResponse } from 'next/server'
import { calculateCashHealth, getExpenseCoverage, getIncomeMetrics } from '@/lib/services/cash-health'

export async function GET() {
  try {
    const health = calculateCashHealth()
    const coverage = getExpenseCoverage()
    const income = getIncomeMetrics()

    return NextResponse.json({ health, coverage, income })
  } catch (error) {
    console.error('Failed to calculate cash health:', error)
    return NextResponse.json({ error: 'Failed to calculate cash health' }, { status: 500 })
  }
}
