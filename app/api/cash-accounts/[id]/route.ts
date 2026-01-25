import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { CashAccount } from '@/lib/types'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const accountId = parseInt(id)
    const body = await request.json()
    const { is_default, name, institution } = body

    const db = getDb()

    // Check account exists
    const existing = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(accountId) as CashAccount | undefined
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // If setting as default, clear default from other accounts of same type
    if (is_default === true) {
      db.prepare(`
        UPDATE cash_accounts
        SET is_default = 0, updated_at = datetime('now')
        WHERE account_type = ? AND id != ?
      `).run(existing.account_type, accountId)
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: (string | number)[] = []

    if (is_default !== undefined) {
      updates.push('is_default = ?')
      values.push(is_default ? 1 : 0)
    }
    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name)
    }
    if (institution !== undefined) {
      updates.push('institution = ?')
      values.push(institution)
    }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')")
      values.push(accountId)

      db.prepare(`
        UPDATE cash_accounts
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values)
    }

    const account = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(accountId) as CashAccount

    return NextResponse.json(account)
  } catch (error) {
    console.error('Failed to update cash account:', error)
    return NextResponse.json({ error: 'Failed to update cash account' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const accountId = parseInt(id)

    const db = getDb()

    // Check account exists
    const existing = db.prepare('SELECT * FROM cash_accounts WHERE id = ?').get(accountId)
    if (!existing) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Soft delete - just deactivate
    db.prepare(`
      UPDATE cash_accounts
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ?
    `).run(accountId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete cash account:', error)
    return NextResponse.json({ error: 'Failed to delete cash account' }, { status: 500 })
  }
}
