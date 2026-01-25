import { NextRequest, NextResponse } from 'next/server'
import {
  syncPayStatementToIncome,
  syncYearToIncome,
  getPayStatementSyncStatus,
  getPayStatements,
} from '@/lib/services/pay-statement'

/**
 * POST /api/pay-statements/sync
 * Sync pay statements to income records
 *
 * Body options:
 * - { statementId: number } - Sync a single statement
 * - { statementIds: number[] } - Sync multiple statements
 * - { year: number } - Sync all statements for a year
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { statementId, statementIds, year } = body

    if (statementId) {
      // Sync single statement
      const result = syncPayStatementToIncome(statementId)
      return NextResponse.json({
        success: true,
        ...result,
      })
    }

    if (statementIds && Array.isArray(statementIds)) {
      // Sync multiple statements
      let created = 0
      let updated = 0
      let skipped = 0
      const details: Array<{
        statementId: number
        incomeType: string
        amount: number
        action: string
        reason?: string
      }> = []

      for (const id of statementIds) {
        try {
          const result = syncPayStatementToIncome(id)
          created += result.created
          updated += result.updated
          skipped += result.skipped
          details.push(
            ...result.details.map(d => ({ statementId: id, ...d }))
          )
        } catch (err) {
          // Log error but continue with other statements
          console.error(`Failed to sync statement ${id}:`, err)
        }
      }

      return NextResponse.json({
        success: true,
        created,
        updated,
        skipped,
        details,
      })
    }

    if (year) {
      // Sync all statements for a year
      const result = syncYearToIncome(year)
      return NextResponse.json({
        success: true,
        ...result,
      })
    }

    return NextResponse.json(
      { error: 'Must provide statementId, statementIds, or year' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Failed to sync pay statements:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/pay-statements/sync?year=2024
 * Get sync status for pay statements
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter required' },
        { status: 400 }
      )
    }

    const statements = getPayStatements(parseInt(year, 10))
    const statementIds = statements.map(s => s.id)
    const syncStatus = getPayStatementSyncStatus(statementIds)

    const statementSyncStatus = statements.map(s => ({
      id: s.id,
      payDate: s.pay_date,
      grossEarnings: s.gross_earnings,
      isSynced: syncStatus.get(s.id) ?? false,
    }))

    const syncedCount = statementSyncStatus.filter(s => s.isSynced).length
    const unsyncedCount = statementSyncStatus.filter(s => !s.isSynced).length

    return NextResponse.json({
      year: parseInt(year, 10),
      totalStatements: statements.length,
      syncedCount,
      unsyncedCount,
      statements: statementSyncStatus,
    })
  } catch (error) {
    console.error('Failed to get sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}
