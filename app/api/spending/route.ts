import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { CreditCardSpendingWithCard } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const cardId = searchParams.get('card_id')

    const db = getDb()
    let query = `
      SELECT s.*, c.name as card_name
      FROM credit_card_spending s
      JOIN credit_cards c ON s.credit_card_id = c.id
      WHERE 1=1
    `
    const params: (string | number)[] = []

    if (year) {
      query += ' AND s.year = ?'
      params.push(parseInt(year))
    }
    if (cardId) {
      query += ' AND s.credit_card_id = ?'
      params.push(parseInt(cardId))
    }

    query += ' ORDER BY s.year DESC, s.month DESC, c.display_order'

    const records = db.prepare(query).all(...params) as CreditCardSpendingWithCard[]
    return NextResponse.json(records)
  } catch (error) {
    console.error('Failed to fetch spending records:', error)
    return NextResponse.json({ error: 'Failed to fetch spending records' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { credit_card_id, year, month, amount, statement_date, notes } = body

    if (!credit_card_id || !year || !month || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()

    // Check if record already exists
    const existing = db.prepare(`
      SELECT * FROM credit_card_spending
      WHERE credit_card_id = ? AND year = ? AND month = ?
    `).get(credit_card_id, year, month)

    if (existing) {
      // Update existing record
      db.prepare(`
        UPDATE credit_card_spending
        SET amount = ?, statement_date = ?, notes = ?, updated_at = datetime('now')
        WHERE credit_card_id = ? AND year = ? AND month = ?
      `).run(amount, statement_date || null, notes || null, credit_card_id, year, month)
    } else {
      // Insert new record
      db.prepare(`
        INSERT INTO credit_card_spending (credit_card_id, year, month, amount, statement_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(credit_card_id, year, month, amount, statement_date || null, notes || null)
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Failed to save spending record:', error)
    return NextResponse.json({ error: 'Failed to save spending record' }, { status: 500 })
  }
}
