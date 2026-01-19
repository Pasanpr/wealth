import { NextResponse } from 'next/server'
import { calculateAllocation, getAccountBreakdown } from '@/lib/services/rebalancing'

export async function GET() {
  try {
    const allocation = calculateAllocation()
    const accountBreakdown = getAccountBreakdown()

    return NextResponse.json({
      ...allocation,
      accountBreakdown,
    })
  } catch (error) {
    console.error('Failed to calculate allocation:', error)
    return NextResponse.json({ error: 'Failed to calculate allocation' }, { status: 500 })
  }
}
