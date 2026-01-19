import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { AccountWithType } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const account = db.prepare(`
      SELECT a.*, at.code as account_type_code, at.name as account_type_name, at.is_tax_advantaged
      FROM accounts a
      JOIN account_types at ON a.account_type_id = at.id
      WHERE a.id = ?
    `).get(params.id) as AccountWithType | undefined

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    return NextResponse.json(account)
  } catch (error) {
    console.error('Failed to fetch account:', error)
    return NextResponse.json({ error: 'Failed to fetch account' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, account_type_id, institution, beneficiary, is_active, notes } = body

    const db = getDb()
    const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    db.prepare(`
      UPDATE accounts
      SET name = ?, account_type_id = ?, institution = ?, beneficiary = ?,
          is_active = ?, notes = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, account_type_id, institution || null, beneficiary || null,
           is_active !== undefined ? (is_active ? 1 : 0) : 1, notes || null, params.id)

    const account = db.prepare(`
      SELECT a.*, at.code as account_type_code, at.name as account_type_name, at.is_tax_advantaged
      FROM accounts a
      JOIN account_types at ON a.account_type_id = at.id
      WHERE a.id = ?
    `).get(params.id) as AccountWithType

    return NextResponse.json(account)
  } catch (error) {
    console.error('Failed to update account:', error)
    return NextResponse.json({ error: 'Failed to update account' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM accounts WHERE id = ?').run(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete account:', error)
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
