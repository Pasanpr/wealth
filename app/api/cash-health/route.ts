import { NextResponse } from 'next/server'
import { calculateCashHealth, getExpenseCoverage } from '@/lib/services/cash-health'

export async function GET() {
  try {
    const health = calculateCashHealth()
    const coverage = getExpenseCoverage()

    return NextResponse.json({ health, coverage })
  } catch (error) {
    console.error('Failed to calculate cash health:', error)
    return NextResponse.json({ error: 'Failed to calculate cash health' }, { status: 500 })
  }
}
