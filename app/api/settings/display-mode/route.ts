import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// GET - Fetch current display mode
export async function GET() {
  try {
    const db = getDb()
    const result = db.prepare(`
      SELECT display_mode FROM onboarding_progress WHERE id = 1
    `).get() as { display_mode: string } | undefined

    return NextResponse.json({ mode: result?.display_mode || 'simple' })
  } catch (error) {
    console.error('Error fetching display mode:', error)
    return NextResponse.json({ mode: 'simple' })
  }
}

// PATCH - Update display mode
export async function PATCH(request: Request) {
  try {
    const { mode } = await request.json()

    if (mode !== 'simple' && mode !== 'advanced') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    const db = getDb()
    db.prepare(`
      UPDATE onboarding_progress
      SET display_mode = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(mode)

    return NextResponse.json({ success: true, mode })
  } catch (error) {
    console.error('Error updating display mode:', error)
    return NextResponse.json(
      { error: 'Failed to update display mode' },
      { status: 500 }
    )
  }
}
