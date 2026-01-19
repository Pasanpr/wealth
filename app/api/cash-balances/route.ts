import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { CashBalance } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const records = db.prepare(`
      SELECT * FROM cash_balances
      ORDER BY date DESC, account_name
    `).all() as CashBalance[]
    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to fetch cash balances:', error)
    return NextResponse.json({ error: 'Failed to fetch cash balances' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { date, balance, account_name, notes } = body

    if (!date || balance === undefined || !account_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO cash_balances (date, balance, account_name, notes)
      VALUES (?, ?, ?, ?)
    `).run(date, balance, account_name, notes || null)

    const record = db.prepare('SELECT * FROM cash_balances WHERE id = ?').get(result.lastInsertRowid) as CashBalance

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error('Failed to create cash balance:', error)
    return NextResponse.json({ error: 'Failed to create cash balance' }, { status: 500 })
  }
}
