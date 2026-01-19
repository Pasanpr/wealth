import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { Setting } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const settings = db.prepare('SELECT * FROM settings').all() as Setting[]
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const db = getDb()

    const updateStmt = db.prepare(`
      UPDATE settings
      SET value = ?, updated_at = datetime('now')
      WHERE key = ?
    `)

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
    `)

    for (const [key, value] of Object.entries(body)) {
      const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key)
      if (existing) {
        updateStmt.run(String(value), key)
      } else {
        insertStmt.run(key, String(value))
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to update settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
