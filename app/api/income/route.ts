import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { IncomeRecord } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const records = db.prepare(`
      SELECT * FROM income_records
      ORDER BY date DESC
    `).all() as IncomeRecord[]
    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to fetch income records:', error)
    return NextResponse.json({ error: 'Failed to fetch income records' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { income_type, amount, date, description, is_recurring } = body

    if (!income_type || amount === undefined || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO income_records (income_type, amount, date, description, is_recurring)
      VALUES (?, ?, ?, ?, ?)
    `).run(income_type, amount, date, description || null, is_recurring ? 1 : 0)

    const record = db.prepare('SELECT * FROM income_records WHERE id = ?').get(result.lastInsertRowid) as IncomeRecord

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Failed to create income record:', error)
    return NextResponse.json({ error: 'Failed to create income record' }, { status: 500 })
  }
}
