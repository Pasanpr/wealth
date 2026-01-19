import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { TaxProfile } from '@/lib/types'

export async function GET() {
  try {
    const db = getDb()
    const profiles = db.prepare(`
      SELECT * FROM tax_profile
      ORDER BY year DESC
    `).all() as TaxProfile[]
    return NextResponse.json(profiles)
  } catch (error) {
    console.error('Failed to fetch tax profiles:', error)
    return NextResponse.json({ error: 'Failed to fetch tax profiles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, gross_income, federal_tax, state_tax } = body

    if (!year || gross_income === undefined || federal_tax === undefined || state_tax === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const db = getDb()

    // Check if year already exists
    const existing = db.prepare('SELECT * FROM tax_profile WHERE year = ?').get(year)
    if (existing) {
      return NextResponse.json({ error: 'Tax profile for this year already exists' }, { status: 409 })
    }

    const result = db.prepare(`
      INSERT INTO tax_profile (year, gross_income, federal_tax, state_tax)
      VALUES (?, ?, ?, ?)
    `).run(year, gross_income, federal_tax, state_tax)

    const profile = db.prepare('SELECT * FROM tax_profile WHERE id = ?').get(result.lastInsertRowid) as TaxProfile

    return NextResponse.json(profile, { status: 201 })
  } catch (error) {
    console.error('Failed to create tax profile:', error)
    return NextResponse.json({ error: 'Failed to create tax profile' }, { status: 500 })
  }
}
