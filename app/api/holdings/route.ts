import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { HoldingWithDetails } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')
    const date = searchParams.get('date')
    const latest = searchParams.get('latest')

    const db = getDb()

    if (latest === 'true') {
      // Get latest holdings per security per account
      let query = `
        SELECT h.*, a.name as account_name, s.symbol as security_symbol, s.name as security_name,
               ac.name as asset_class_name
        FROM holdings h
        JOIN accounts a ON h.account_id = a.id
        JOIN securities s ON h.security_id = s.id
        LEFT JOIN asset_classes ac ON s.asset_class_id = ac.id
        INNER JOIN (
          SELECT account_id, security_id, MAX(date) as max_date
          FROM holdings
          ${accountId ? 'WHERE account_id = ?' : ''}
          GROUP BY account_id, security_id
        ) latest ON h.account_id = latest.account_id
                 AND h.security_id = latest.security_id
                 AND h.date = latest.max_date
        ORDER BY a.name, s.symbol
      `
      const params = accountId ? [parseInt(accountId)] : []
      const holdings = db.prepare(query).all(...params) as HoldingWithDetails[]
      return NextResponse.json(holdings)
    }

    let query = `
      SELECT h.*, a.name as account_name, s.symbol as security_symbol, s.name as security_name,
             ac.name as asset_class_name
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      JOIN securities s ON h.security_id = s.id
      LEFT JOIN asset_classes ac ON s.asset_class_id = ac.id
      WHERE 1=1
    `
    const params: (string | number)[] = []

    if (accountId) {
      query += ' AND h.account_id = ?'
      params.push(parseInt(accountId))
    }
    if (date) {
      query += ' AND h.date = ?'
      params.push(date)
    }

    query += ' ORDER BY h.date DESC, a.name, s.symbol'

    const holdings = db.prepare(query).all(...params) as HoldingWithDetails[]
    return NextResponse.json(holdings)
  } catch (error) {
    console.error('Failed to fetch holdings:', error)
    return NextResponse.json({ error: 'Failed to fetch holdings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id, security_id, date, value, shares, cost_basis } = body

    if (!account_id || !security_id || !date || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO holdings (account_id, security_id, date, value, shares, cost_basis)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(account_id, security_id, date, value, shares || null, cost_basis || null)

    const holding = db.prepare(`
      SELECT h.*, a.name as account_name, s.symbol as security_symbol, s.name as security_name,
             ac.name as asset_class_name
      FROM holdings h
      JOIN accounts a ON h.account_id = a.id
      JOIN securities s ON h.security_id = s.id
      LEFT JOIN asset_classes ac ON s.asset_class_id = ac.id
      WHERE h.id = ?
    `).get(result.lastInsertRowid) as HoldingWithDetails

    return NextResponse.json(holding, { status: 201 })
  } catch (error) {
    console.error('Failed to create holding:', error)
    return NextResponse.json({ error: 'Failed to create holding' }, { status: 500 })
  }
}
