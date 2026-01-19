import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { IncomeRecord } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const record = db.prepare('SELECT * FROM income_records WHERE id = ?').get(params.id) as IncomeRecord | undefined

    if (!record) {
      return NextResponse.json({ error: 'Income record not found' }, { status: 404 })
    }

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to fetch income record:', error)
    return NextResponse.json({ error: 'Failed to fetch income record' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { income_type, amount, date, description, is_recurring } = body

    const db = getDb()
    const existing = db.prepare('SELECT * FROM income_records WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Income record not found' }, { status: 404 })
    }

    db.prepare(`
      UPDATE income_records
      SET income_type = ?, amount = ?, date = ?, description = ?, is_recurring = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(income_type, amount, date, description || null, is_recurring ? 1 : 0, params.id)

    const record = db.prepare('SELECT * FROM income_records WHERE id = ?').get(params.id) as IncomeRecord

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to update income record:', error)
    return NextResponse.json({ error: 'Failed to update income record' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM income_records WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Income record not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM income_records WHERE id = ?').run(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete income record:', error)
    return NextResponse.json({ error: 'Failed to delete income record' }, { status: 500 })
  }
}
