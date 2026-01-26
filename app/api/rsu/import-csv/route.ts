import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { RsuVesting } from '@/lib/types'
import {
  parseEtradeBenefitsCSV,
  upcomingVestsToRsuRecords,
} from '@/lib/services/csv/etrade-benefits-parser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const previewOnly = formData.get('previewOnly') === 'true'
    const currentPrice = parseFloat(formData.get('currentPrice') as string) || 0
    const importType = formData.get('importType') as string || 'upcoming' // 'upcoming' or 'all'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    const csvContent = await file.text()
    const parsed = parseEtradeBenefitsCSV(csvContent)

    if (previewOnly) {
      return NextResponse.json({
        preview: true,
        grants: parsed.grants,
        upcomingVests: parsed.upcomingVests,
        completedVests: parsed.completedVests,
        summary: {
          totalGrants: parsed.grants.length,
          totalUpcoming: parsed.upcomingVests.length,
          totalCompleted: parsed.completedVests.length,
          totalUnvestedShares: parsed.upcomingVests.reduce((sum, v) => sum + v.shares, 0),
          totalVestedShares: parsed.completedVests.reduce((sum, v) => sum + v.shares, 0),
        },
      })
    }

    // Import records to database
    const db = getDb()

    // Convert to RSU records
    type RsuRecord = ReturnType<typeof upcomingVestsToRsuRecords>[number]
    const records: RsuRecord[] = upcomingVestsToRsuRecords(parsed.upcomingVests, currentPrice)

    const insertStmt = db.prepare(`
      INSERT INTO rsu_vesting_schedule (
        grant_date, grant_id, grant_price, vest_date, shares, is_vested,
        actual_price_at_vest, sale_date, sale_price, gross_proceeds,
        taxes_withheld, net_proceeds, reinvested_amount, cash_retained
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertMany = db.transaction((recs: RsuRecord[]) => {
      const inserted: RsuVesting[] = []

      for (const record of recs) {
        const result = insertStmt.run(
          record.grant_date,
          record.grant_id,
          record.grant_price,
          record.vest_date,
          record.shares,
          record.is_vested ? 1 : 0,
          record.actual_price_at_vest,
          record.sale_date,
          record.sale_price,
          record.gross_proceeds,
          record.taxes_withheld,
          record.net_proceeds,
          record.reinvested_amount,
          record.cash_retained
        )

        const insertedRecord = db
          .prepare('SELECT * FROM rsu_vesting_schedule WHERE id = ?')
          .get(result.lastInsertRowid) as RsuVesting
        inserted.push(insertedRecord)
      }

      return inserted
    })

    const insertedRecords = insertMany(records)

    return NextResponse.json({
      success: true,
      count: insertedRecords.length,
      records: insertedRecords,
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to import CSV:', error)
    return NextResponse.json(
      { error: 'Failed to import CSV', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
