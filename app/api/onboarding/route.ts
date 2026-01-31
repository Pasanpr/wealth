import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export interface OnboardingProgress {
  asset_classes_done: boolean
  securities_done: boolean
  accounts_done: boolean
  credit_cards_done: boolean
  import_done: boolean
  completed_at: string | null
  dismissed: boolean
  // Computed fields
  completedSteps: number
  totalSteps: number
  percentComplete: number
}

// GET - Fetch current onboarding progress with auto-detection
export async function GET() {
  try {
    const db = getDb()

    // Get stored progress
    const progress = db.prepare(`
      SELECT * FROM onboarding_progress WHERE id = 1
    `).get() as {
      asset_classes_done: number
      securities_done: number
      accounts_done: number
      credit_cards_done: number
      import_done: number
      completed_at: string | null
      dismissed: number
    }

    // Auto-detect completion based on existing data
    const assetClassCount = db.prepare(`
      SELECT COUNT(*) as count FROM asset_classes WHERE target_allocation > 0
    `).get() as { count: number }

    const securityCount = db.prepare(`
      SELECT COUNT(*) as count FROM securities
    `).get() as { count: number }

    const accountCount = db.prepare(`
      SELECT COUNT(*) as count FROM accounts
    `).get() as { count: number }

    const creditCardCount = db.prepare(`
      SELECT COUNT(*) as count FROM credit_cards
    `).get() as { count: number }

    const holdingsCount = db.prepare(`
      SELECT COUNT(*) as count FROM holdings
    `).get() as { count: number }

    // Determine completion status (either explicitly marked or auto-detected)
    const asset_classes_done = progress.asset_classes_done === 1 || assetClassCount.count > 0
    const securities_done = progress.securities_done === 1 || securityCount.count > 0
    const accounts_done = progress.accounts_done === 1 || accountCount.count > 0
    const credit_cards_done = progress.credit_cards_done === 1 || creditCardCount.count > 0
    const import_done = progress.import_done === 1 || holdingsCount.count > 0

    // Calculate completion
    const steps = [asset_classes_done, securities_done, accounts_done, credit_cards_done, import_done]
    const completedSteps = steps.filter(Boolean).length
    const totalSteps = steps.length
    const percentComplete = Math.round((completedSteps / totalSteps) * 100)

    // Auto-complete if all steps done
    let completed_at = progress.completed_at
    if (completedSteps === totalSteps && !completed_at) {
      completed_at = new Date().toISOString()
      db.prepare(`
        UPDATE onboarding_progress
        SET completed_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(completed_at)
    }

    const response: OnboardingProgress = {
      asset_classes_done,
      securities_done,
      accounts_done,
      credit_cards_done,
      import_done,
      completed_at,
      dismissed: progress.dismissed === 1,
      completedSteps,
      totalSteps,
      percentComplete,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching onboarding progress:', error)
    return NextResponse.json(
      { error: 'Failed to fetch onboarding progress' },
      { status: 500 }
    )
  }
}

// PATCH - Update specific step completion
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const db = getDb()

    const allowedFields = [
      'asset_classes_done',
      'securities_done',
      'accounts_done',
      'credit_cards_done',
      'import_done',
      'dismissed',
    ]

    const updates: string[] = []
    const values: (number | string)[] = []

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`)
        values.push(value ? 1 : 0)
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.push('updated_at = CURRENT_TIMESTAMP')

    db.prepare(`
      UPDATE onboarding_progress
      SET ${updates.join(', ')}
      WHERE id = 1
    `).run(...values)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating onboarding progress:', error)
    return NextResponse.json(
      { error: 'Failed to update onboarding progress' },
      { status: 500 }
    )
  }
}
