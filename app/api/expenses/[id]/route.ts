import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { YearlyExpense } from '@/lib/types'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { year, total_amount, notes } = body

    const db = getDb()
    const existing = db.prepare('SELECT * FROM yearly_expenses WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Expense record not found' }, { status: 404 })
    }

    db.prepare(`
      UPDATE yearly_expenses
      SET year = ?, total_amount = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(year, total_amount, notes || null, params.id)

    const record = db.prepare('SELECT * FROM yearly_expenses WHERE id = ?').get(params.id) as YearlyExpense

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to update expense record:', error)
    return NextResponse.json({ error: 'Failed to update expense record' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM yearly_expenses WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Expense record not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM yearly_expenses WHERE id = ?').run(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete expense record:', error)
    return NextResponse.json({ error: 'Failed to delete expense record' }, { status: 500 })
  }
}
