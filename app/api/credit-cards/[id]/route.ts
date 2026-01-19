import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { CreditCard } from '@/lib/types'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, issuer, last4, credit_limit, is_active, display_order } = body

    const db = getDb()
    const existing = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Credit card not found' }, { status: 404 })
    }

    db.prepare(`
      UPDATE credit_cards
      SET name = ?, issuer = ?, last4 = ?, credit_limit = ?, is_active = ?, display_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, issuer || null, last4 || null, credit_limit || null, is_active ? 1 : 0, display_order || 0, params.id)

    const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(params.id) as CreditCard

    return NextResponse.json(card)
  } catch (error) {
    console.error('Failed to update credit card:', error)
    return NextResponse.json({ error: 'Failed to update credit card' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Credit card not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM credit_cards WHERE id = ?').run(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete credit card:', error)
    return NextResponse.json({ error: 'Failed to delete credit card' }, { status: 500 })
  }
}
