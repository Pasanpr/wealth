import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { AssetClass } from '@/lib/types'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { name, description, target_allocation, display_order } = body

    const db = getDb()
    const existing = db.prepare('SELECT * FROM asset_classes WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Asset class not found' }, { status: 404 })
    }

    db.prepare(`
      UPDATE asset_classes
      SET name = ?, description = ?, target_allocation = ?, display_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, description || null, target_allocation || 0, display_order || 0, params.id)

    const assetClass = db.prepare('SELECT * FROM asset_classes WHERE id = ?').get(params.id) as AssetClass

    return NextResponse.json(assetClass)
  } catch (error) {
    console.error('Failed to update asset class:', error)
    return NextResponse.json({ error: 'Failed to update asset class' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM asset_classes WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'Asset class not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM asset_classes WHERE id = ?').run(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete asset class:', error)
    return NextResponse.json({ error: 'Failed to delete asset class' }, { status: 500 })
  }
}
