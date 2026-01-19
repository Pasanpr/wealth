import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { SecurityWithAssetClass } from '@/lib/types'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { symbol, name, description, asset_class_id } = body

    const db = getDb()
    const existing = db.prepare('SELECT * FROM securities WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Security not found' }, { status: 404 })
    }

    db.prepare(`
      UPDATE securities
      SET symbol = ?, name = ?, description = ?, asset_class_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(symbol.toUpperCase(), name, description || null, asset_class_id || null, params.id)

    const security = db.prepare(`
      SELECT s.*, ac.name as asset_class_name
      FROM securities s
      LEFT JOIN asset_classes ac ON s.asset_class_id = ac.id
      WHERE s.id = ?
    `).get(params.id) as SecurityWithAssetClass

    return NextResponse.json(security)
  } catch (error) {
    console.error('Failed to update security:', error)
    return NextResponse.json({ error: 'Failed to update security' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM securities WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Security not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM securities WHERE id = ?').run(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete security:', error)
    return NextResponse.json({ error: 'Failed to delete security' }, { status: 500 })
  }
}
