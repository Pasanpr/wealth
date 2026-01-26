import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

type ResetSection =
  | 'pay_statements'
  | 'portfolio'
  | 'income'
  | 'credit_cards'
  | 'cash'

interface ResetRequest {
  sections: ResetSection[]
  confirm: boolean
}

interface SectionInfo {
  name: string
  tables: string[]
  description: string
}

const SECTIONS: Record<ResetSection, SectionInfo> = {
  pay_statements: {
    name: 'Pay Statements',
    tables: ['pay_statement_deposits', 'pay_statement_items', 'pay_statements'],
    description: 'All imported pay statements and their line items',
  },
  portfolio: {
    name: 'Portfolio',
    tables: ['holdings', 'cash_flows', 'portfolio_snapshots', 'accounts'],
    description: 'Investment accounts, holdings, and cash flows',
  },
  income: {
    name: 'Income & RSU',
    tables: ['income_records', 'rsu_vesting_schedule'],
    description: 'Income records and RSU vesting schedules',
  },
  credit_cards: {
    name: 'Credit Cards',
    tables: ['credit_card_spending', 'credit_cards'],
    description: 'Credit cards and spending history',
  },
  cash: {
    name: 'Cash Accounts & Balances',
    tables: ['monthly_cash_balances', 'cash_accounts', 'cash_balances'],
    description: 'Cash accounts and monthly balance history',
  },
}

export async function GET() {
  try {
    const db = getDb()
    const sections: Record<string, { info: SectionInfo; recordCount: number }> = {}

    for (const [key, info] of Object.entries(SECTIONS)) {
      let totalCount = 0
      for (const table of info.tables) {
        try {
          const result = db
            .prepare(`SELECT COUNT(*) as count FROM ${table}`)
            .get() as { count: number }
          totalCount += result.count
        } catch {
          // Table might not exist yet
        }
      }
      sections[key] = { info, recordCount: totalCount }
    }

    return NextResponse.json({ sections })
  } catch (error) {
    console.error('Failed to get reset sections:', error)
    return NextResponse.json(
      { error: 'Failed to get reset sections' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResetRequest

    if (!body.confirm) {
      return NextResponse.json(
        { error: 'Reset must be confirmed' },
        { status: 400 }
      )
    }

    if (!body.sections || body.sections.length === 0) {
      return NextResponse.json(
        { error: 'No sections specified for reset' },
        { status: 400 }
      )
    }

    // Validate sections
    for (const section of body.sections) {
      if (!(section in SECTIONS)) {
        return NextResponse.json(
          { error: `Invalid section: ${section}` },
          { status: 400 }
        )
      }
    }

    const db = getDb()
    const results: Record<string, { deleted: number; tables: string[] }> = {}

    for (const section of body.sections) {
      const sectionInfo = SECTIONS[section]
      let totalDeleted = 0

      // Delete from tables in order (child tables first due to FK constraints)
      for (const table of sectionInfo.tables) {
        try {
          const result = db.prepare(`DELETE FROM ${table}`).run()
          totalDeleted += result.changes
        } catch (err) {
          console.error(`Failed to delete from ${table}:`, err)
        }
      }

      results[section] = {
        deleted: totalDeleted,
        tables: sectionInfo.tables,
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reset completed for: ${body.sections.join(', ')}`,
      results,
    })
  } catch (error) {
    console.error('Failed to reset database sections:', error)
    return NextResponse.json(
      { error: 'Failed to reset database sections' },
      { status: 500 }
    )
  }
}
