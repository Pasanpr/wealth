import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { RsuW2Data } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const records = db.prepare(`
      SELECT * FROM rsu_w2_data
      ORDER BY year DESC
    `).all() as RsuW2Data[]
    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to fetch W-2 data:', error)
    return NextResponse.json({ error: 'Failed to fetch W-2 data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      year,
      total_rsu_income,
      federal_withheld,
      state_withheld,
      social_security_withheld,
      medicare_withheld,
      notes,
    } = body

    if (!year || total_rsu_income === undefined) {
      return NextResponse.json({ error: 'Year and RSU income are required' }, { status: 400 })
    }

    const db = getDb()

    // Use upsert to update if year exists
    const existing = db.prepare('SELECT id FROM rsu_w2_data WHERE year = ?').get(year) as { id: number } | undefined

    if (existing) {
      db.prepare(`
        UPDATE rsu_w2_data
        SET total_rsu_income = ?, federal_withheld = ?, state_withheld = ?,
            social_security_withheld = ?, medicare_withheld = ?, notes = ?,
            updated_at = datetime('now')
        WHERE year = ?
      `).run(
        total_rsu_income,
        federal_withheld || 0,
        state_withheld || 0,
        social_security_withheld || 0,
        medicare_withheld || 0,
        notes || null,
        year
      )

      const record = db.prepare('SELECT * FROM rsu_w2_data WHERE year = ?').get(year) as RsuW2Data
      return NextResponse.json(record)
    }

    const result = db.prepare(`
      INSERT INTO rsu_w2_data (year, total_rsu_income, federal_withheld, state_withheld,
        social_security_withheld, medicare_withheld, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      year,
      total_rsu_income,
      federal_withheld || 0,
      state_withheld || 0,
      social_security_withheld || 0,
      medicare_withheld || 0,
      notes || null
    )

    const record = db.prepare('SELECT * FROM rsu_w2_data WHERE id = ?').get(result.lastInsertRowid) as RsuW2Data

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Failed to save W-2 data:', error)
    return NextResponse.json({ error: 'Failed to save W-2 data' }, { status: 500 })
  }
}
