import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { CashAccount } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const accounts = db.prepare(`
      SELECT * FROM cash_accounts
      WHERE is_active = 1
      ORDER BY display_order, name
    `).all() as CashAccount[]
    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Failed to fetch cash accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch cash accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, account_type, institution } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const db = getDb()

    // Check if account with same name exists (even if inactive)
    const existing = db.prepare('SELECT * FROM cash_accounts WHERE name = ?').get(name) as CashAccount | undefined

    if (existing) {
      // Reactivate if inactive
      if (!existing.is_active) {
        db.prepare(`
          UPDATE cash_accounts
          SET is_active = 1, account_type = ?, institution = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(account_type || 'checking', institution || null, existing.id)

        const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(existing.id) as CashAccount
        return NextResponse.json(account, { status: 200 })
      }
      return NextResponse.json({ error: 'Account with this name already exists' }, { status: 400 })
    }

    // Get max display order
    const maxOrder = db.prepare('SELECT MAX(display_order) as max FROM cash_accounts').get() as { max: number | null }
    const displayOrder = (maxOrder.max ?? -1) + 1

    const result = db.prepare(`
      INSERT INTO cash_accounts (name, account_type, institution, display_order)
      VALUES (?, ?, ?, ?)
    `).run(name, account_type || 'checking', institution || null, displayOrder)

    const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(result.lastInsertRowid) as CashAccount

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Failed to create cash account:', error)
    return NextResponse.json({ error: 'Failed to create cash account' }, { status: 500 })
  }
}
