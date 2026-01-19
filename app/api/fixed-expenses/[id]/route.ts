import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const expense = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(id)

    if (!expense) {
      return NextResponse.json({ error: 'Fixed expense not found' }, { status: 404 })
    }

    return NextResponse.json(expense)
  } catch (error) {
    console.error('Failed to fetch fixed expense:', error)
    return NextResponse.json({ error: 'Failed to fetch fixed expense' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const body = await request.json()
    const { name, amount, is_active, display_order } = body

    const existing = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Fixed expense not found' }, { status: 404 })
    }

    db.prepare(`
      UPDATE fixed_expenses
      SET name = ?, amount = ?, is_active = ?, display_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ?? (existing as { name: string }).name,
      amount ?? (existing as { amount: number }).amount,
      is_active !== undefined ? (is_active ? 1 : 0) : (existing as { is_active: number }).is_active,
      display_order ?? (existing as { display_order: number }).display_order,
      id
    )

    const updated = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(id)
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update fixed expense:', error)
    return NextResponse.json({ error: 'Failed to update fixed expense' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb()
    const { id } = await params
    const existing = db.prepare('SELECT * FROM fixed_expenses WHERE id = ?').get(id)
    if (!existing) {
      return NextResponse.json({ error: 'Fixed expense not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM fixed_expenses WHERE id = ?').run(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete fixed expense:', error)
    return NextResponse.json({ error: 'Failed to delete fixed expense' }, { status: 500 })
  }
}
