import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { YearlyExpense } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const records = db.prepare(`
      SELECT * FROM yearly_expenses
      ORDER BY year DESC
    `).all() as YearlyExpense[]
    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to fetch expense records:', error)
    return NextResponse.json({ error: 'Failed to fetch expense records' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, total_amount, notes } = body

    if (!year || total_amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()

    // Check if year already exists
    const existing = db.prepare('SELECT * FROM yearly_expenses WHERE year = ?').get(year)
    if (existing) {
      return NextResponse.json({ error: 'Expense record for this year already exists' }, { status: 409 })
    }

    const result = db.prepare(`
      INSERT INTO yearly_expenses (year, total_amount, notes)
      VALUES (?, ?, ?)
    `).run(year, total_amount, notes || null)

    const record = db.prepare('SELECT * FROM yearly_expenses WHERE id = ?').get(result.lastInsertRowid) as YearlyExpense

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Failed to create expense record:', error)
    return NextResponse.json({ error: 'Failed to create expense record' }, { status: 500 })
  }
}
