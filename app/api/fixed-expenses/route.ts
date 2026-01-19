import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { FixedExpense } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const expenses = db.prepare(`
      SELECT * FROM fixed_expenses
      ORDER BY display_order, name
    `).all() as FixedExpense[]

    return NextResponse.json(expenses)
  } catch (error) {
    console.error('Failed to fetch fixed expenses:', error)
    return NextResponse.json({ error: 'Failed to fetch fixed expenses' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { name, amount, is_active = true, display_order = 0 } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const result = db.prepare(`
      INSERT INTO fixed_expenses (name, amount, is_active, display_order)
      VALUES (?, ?, ?, ?)
    `).run(name, amount || 0, is_active ? 1 : 0, display_order)

    const expense = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(result.lastInsertRowid)

    return NextResponse.json(expense, { status: 201 })
  } catch (error) {
    console.error('Failed to create fixed expense:', error)
    return NextResponse.json({ error: 'Failed to create fixed expense' }, { status: 500 })
  }
}
