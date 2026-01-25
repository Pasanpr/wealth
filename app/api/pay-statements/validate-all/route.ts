import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { validatePayStatement } from '@/lib/services/pdf/pay-statement-validator'
import {
  PayStatement,
  PayStatementItemWithCategory,
  PayStatementDeposit,
  ParsedPayStatement,
  ParsedPayItem,
} from '@/lib/types'

/**
 * GET /api/pay-statements/validate-all?year=YYYY
 * Re-validates all stored statements and returns issues
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')

    const db = getDb()

    // Build query
    let query = 'SELECT * FROM pay_statements'
    const params: string[] = []

    if (yearParam) {
      query += " WHERE strftime('%Y', pay_date) = ?"
      params.push(yearParam)
    }

    query += ' ORDER BY pay_date ASC'

    const statements = db.prepare(query).all(...params) as PayStatement[]

    const results: Array<{
      id: number
      payDate: string
      periodStart: string
      periodEnd: string
      isRsuStub: boolean
      grossEarnings: number
      netPay: number
      issueCount: number
      errorCount: number
      warningCount: number
      issues: Array<{
        severity: string
        field: string
        message: string
        expected?: number
        actual?: number
      }>
    }> = []

    let totalErrors = 0
    let totalWarnings = 0

    for (const stmt of statements) {
      // Get items for this statement
      const items = db
        .prepare(
          `SELECT i.*, c.code as category_code, c.name as category_name
           FROM pay_statement_items i
           JOIN pay_item_categories c ON i.category_id = c.id
           WHERE i.pay_statement_id = ?`
        )
        .all(stmt.id) as PayStatementItemWithCategory[]

      // Get deposits
      const deposits = db
        .prepare('SELECT * FROM pay_statement_deposits WHERE pay_statement_id = ?')
        .all(stmt.id) as PayStatementDeposit[]

      // Convert to ParsedPayStatement format for validation
      const parsed: ParsedPayStatement = {
        periodStart: stmt.period_start,
        periodEnd: stmt.period_end,
        payDate: stmt.pay_date,
        sourceType: stmt.source_type as 'adp' | 'manual' | 'other',
        grossEarnings: stmt.gross_earnings,
        totalTaxes: stmt.total_taxes,
        totalDeductions: stmt.total_deductions,
        employerBenefits: stmt.employer_benefits,
        netPay: stmt.net_pay,
        items: items.map(
          (i): ParsedPayItem => ({
            categoryCode: i.category_code,
            itemCode: i.item_code,
            itemName: i.item_name,
            currentAmount: i.current_amount,
            ytdAmount: i.ytd_amount ?? undefined,
            hours: i.hours ?? undefined,
            rate: i.rate ?? undefined,
          })
        ),
        deposits: deposits.map(d => ({
          accountType: d.account_type,
          accountLast4: d.account_last4 ?? undefined,
          amount: d.amount,
        })),
      }

      const validation = validatePayStatement(parsed)

      const isRsuStub =
        stmt.period_start === stmt.period_end &&
        items.some(i => i.item_code === 'RSU_VEST' && i.current_amount > 0) &&
        stmt.net_pay === 0

      const errorCount = validation.issues.filter(i => i.severity === 'error').length
      const warningCount = validation.issues.filter(i => i.severity === 'warning').length

      totalErrors += errorCount
      totalWarnings += warningCount

      // Only include statements with issues
      if (validation.issues.length > 0) {
        results.push({
          id: stmt.id,
          payDate: stmt.pay_date,
          periodStart: stmt.period_start,
          periodEnd: stmt.period_end,
          isRsuStub,
          grossEarnings: stmt.gross_earnings,
          netPay: stmt.net_pay,
          issueCount: validation.issues.length,
          errorCount,
          warningCount,
          issues: validation.issues.map(i => ({
            severity: i.severity,
            field: i.field,
            message: i.message,
            expected: i.expected,
            actual: i.actual,
          })),
        })
      }
    }

    return NextResponse.json({
      totalStatements: statements.length,
      statementsWithIssues: results.length,
      totalErrors,
      totalWarnings,
      statements: results,
    })
  } catch (error) {
    console.error('Failed to validate statements:', error)
    return NextResponse.json(
      { error: 'Failed to validate statements' },
      { status: 500 }
    )
  }
}
