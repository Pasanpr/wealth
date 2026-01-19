import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { CashFlowWithAccount } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('account_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const db = getDb()
    let query = `
      SELECT cf.*, a.name as account_name
      FROM cash_flows cf
      JOIN accounts a ON cf.account_id = a.id
      WHERE 1=1
    `
    const params: (string | number)[] = []

    if (accountId) {
      query += ' AND cf.account_id = ?'
      params.push(parseInt(accountId))
    }
    if (startDate) {
      query += ' AND cf.date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      query += ' AND cf.date <= ?'
      params.push(endDate)
    }

    query += ' ORDER BY cf.date DESC'

    const flows = db.prepare(query).all(...params) as CashFlowWithAccount[]
    return NextResponse.json(flows)
  } catch (error) {
    console.error('Failed to fetch cash flows:', error)
    return NextResponse.json({ error: 'Failed to fetch cash flows' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { account_id, date, amount, flow_type, description } = body

    if (!account_id || !date || amount === undefined || !flow_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO cash_flows (account_id, date, amount, flow_type, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(account_id, date, amount, flow_type, description || null)

    const flow = db.prepare(`
      SELECT cf.*, a.name as account_name
      FROM cash_flows cf
      JOIN accounts a ON cf.account_id = a.id
      WHERE cf.id = ?
    `).get(result.lastInsertRowid) as CashFlowWithAccount

    return NextResponse.json(flow, { status: 201 })
  } catch (error) {
    console.error('Failed to create cash flow:', error)
    return NextResponse.json({ error: 'Failed to create cash flow' }, { status: 500 })
  }
}
