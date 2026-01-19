import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { AccountWithType } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const accounts = db.prepare(`
      SELECT a.*, at.code as account_type_code, at.name as account_type_name, at.is_tax_advantaged
      FROM accounts a
      JOIN account_types at ON a.account_type_id = at.id
      WHERE a.is_active = 1
      ORDER BY a.name
    `).all() as AccountWithType[]
    return NextResponse.json(accounts)
  } catch (error) {
    console.error('Failed to fetch accounts:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, account_type_id, institution, beneficiary, notes } = body

    if (!name || !account_type_id) {
      return NextResponse.json({ error: 'Name and account type are required' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO accounts (name, account_type_id, institution, beneficiary, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, account_type_id, institution || null, beneficiary || null, notes || null)

    const account = db.prepare(`
      SELECT a.*, at.code as account_type_code, at.name as account_type_name, at.is_tax_advantaged
      FROM accounts a
      JOIN account_types at ON a.account_type_id = at.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid) as AccountWithType

    return NextResponse.json(account, { status: 201 })
  } catch (error) {
    console.error('Failed to create account:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
