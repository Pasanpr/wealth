import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { SecurityWithAssetClass } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const securities = db.prepare(`
      SELECT s.*, ac.name as asset_class_name
      FROM securities s
      LEFT JOIN asset_classes ac ON s.asset_class_id = ac.id
      ORDER BY s.symbol
    `).all() as SecurityWithAssetClass[]
    return NextResponse.json(securities)
  } catch (error) {
    console.error('Failed to fetch securities:', error)
    return NextResponse.json({ error: 'Failed to fetch securities' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { symbol, name, description, asset_class_id } = body

    if (!symbol || !name) {
      return NextResponse.json({ error: 'Symbol and name are required' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO securities (symbol, name, description, asset_class_id)
      VALUES (?, ?, ?, ?)
    `).run(symbol.toUpperCase(), name, description || null, asset_class_id || null)

    const security = db.prepare(`
      SELECT s.*, ac.name as asset_class_name
      FROM securities s
      LEFT JOIN asset_classes ac ON s.asset_class_id = ac.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid) as SecurityWithAssetClass

    return NextResponse.json(security, { status: 201 })
  } catch (error) {
    console.error('Failed to create security:', error)
    return NextResponse.json({ error: 'Failed to create security' }, { status: 500 })
  }
}
