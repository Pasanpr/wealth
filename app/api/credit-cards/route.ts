import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { CreditCard } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const cards = db.prepare(`
      SELECT * FROM credit_cards
      WHERE is_active = 1
      ORDER BY display_order, name
    `).all() as CreditCard[]
    return NextResponse.json(cards)
  } catch (error) {
    console.error('Failed to fetch credit cards:', error)
    return NextResponse.json({ error: 'Failed to fetch credit cards' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, issuer, last4, credit_limit, display_order } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO credit_cards (name, issuer, last4, credit_limit, display_order)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, issuer || null, last4 || null, credit_limit || null, display_order || 0)

    const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(result.lastInsertRowid) as CreditCard

    return NextResponse.json(card, { status: 201 })
  } catch (error) {
    console.error('Failed to create credit card:', error)
    return NextResponse.json({ error: 'Failed to create credit card' }, { status: 500 })
  }
}
