import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { RsuVesting } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const records = db.prepare(`
      SELECT * FROM rsu_vesting_schedule
      ORDER BY vest_date DESC
    `).all() as RsuVesting[]
    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to fetch RSU records:', error)
    return NextResponse.json({ error: 'Failed to fetch RSU records' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { vest_date, shares, grant_price, grant_date, grant_id, is_vested, actual_price_at_vest } = body

    if (!vest_date || shares === undefined || grant_price === undefined || !grant_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO rsu_vesting_schedule (vest_date, shares, grant_price, grant_date, grant_id, is_vested, actual_price_at_vest)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(vest_date, shares, grant_price, grant_date, grant_id || null, is_vested ? 1 : 0, actual_price_at_vest || null)

    const record = db.prepare('SELECT * FROM rsu_vesting_schedule WHERE id = ?').get(result.lastInsertRowid) as RsuVesting

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Failed to create RSU record:', error)
    return NextResponse.json({ error: 'Failed to create RSU record' }, { status: 500 })
  }
}
