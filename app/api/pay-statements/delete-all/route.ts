import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

/**
 * DELETE /api/pay-statements/delete-all
 * Deletes all pay statements. Requires confirmation query param.
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const confirm = searchParams.get('confirm')

    if (confirm !== 'yes') {
      return NextResponse.json(
        { error: 'Must pass ?confirm=yes to delete all statements' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Get count before deletion
    const countResult = db
      .prepare('SELECT COUNT(*) as count FROM pay_statements')
      .get() as { count: number }

    // Delete all (cascades to items and deposits via foreign keys)
    db.prepare('DELETE FROM pay_statements').run()

    return NextResponse.json({
      success: true,
      deletedCount: countResult.count,
      message: `Deleted ${countResult.count} pay statements`,
    })
  } catch (error) {
    console.error('Failed to delete pay statements:', error)
    return NextResponse.json(
      { error: 'Failed to delete pay statements' },
      { status: 500 }
    )
  }
}
