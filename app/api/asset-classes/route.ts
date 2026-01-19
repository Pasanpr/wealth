import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { AssetClass } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const classes = db.prepare(`
      SELECT * FROM asset_classes
      ORDER BY display_order, name
    `).all() as AssetClass[]
    return NextResponse.json(classes)
  } catch (error) {
    console.error('Failed to fetch asset classes:', error)
    return NextResponse.json({ error: 'Failed to fetch asset classes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, target_allocation, display_order } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const db = getDb()
    const result = db.prepare(`
      INSERT INTO asset_classes (name, description, target_allocation, display_order)
      VALUES (?, ?, ?, ?)
    `).run(name, description || null, target_allocation || 0, display_order || 0)

    const assetClass = db.prepare('SELECT * FROM asset_classes WHERE id = ?').get(result.lastInsertRowid) as AssetClass

    return NextResponse.json(assetClass, { status: 201 })
  } catch (error) {
    console.error('Failed to create asset class:', error)
    return NextResponse.json({ error: 'Failed to create asset class' }, { status: 500 })
  }
}
