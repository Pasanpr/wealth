import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { AccountType } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const types = db.prepare(`
      SELECT * FROM account_types
      ORDER BY name
    `).all() as AccountType[]
    return NextResponse.json(types)
  } catch (error) {
    console.error('Failed to fetch account types:', error)
    return NextResponse.json({ error: 'Failed to fetch account types' }, { status: 500 })
  }
}
