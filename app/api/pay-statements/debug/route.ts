import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { PayStatement, PayStatementItemWithCategory } from '@/lib/types'

interface DebugReport {
  year: number
  statementCount: number
  expectedCount: {
    biweekly: number
    semimonthly: number
  }
  dateRange: {
    first: string | null
    last: string | null
  }
  gaps: { after: string; before: string; daysMissing: number }[]

  // Calculated totals from summing all statements
  calculated: {
    grossEarnings: number
    totalTaxes: number
    totalDeductions: number
    employerBenefits: number
    netPay: number
  }

  // YTD values from the last pay stub of the year
  lastStubYtd: {
    grossEarnings: number | null
    totalTaxes: number | null
    totalDeductions: number | null
    netPay: number | null
  }

  // Discrepancies between calculated and YTD
  discrepancies: {
    field: string
    calculated: number
    ytd: number | null
    difference: number | null
  }[]

  // Item-level breakdown showing each item code total
  itemBreakdown: {
    categoryCode: string
    itemCode: string
    total: number
    occurrences: number
  }[]

  // Per-statement details for manual review
  statements: {
    id: number
    payDate: string
    periodStart: string
    periodEnd: string
    grossEarnings: number
    totalTaxes: number
    totalDeductions: number
    netPay: number
    calculatedNet: number
    netDiscrepancy: number
  }[]
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')

    if (!yearParam) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      )
    }

    const year = parseInt(yearParam, 10)
    if (isNaN(year)) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 })
    }

    const db = getDb()

    // Get all statements for the year
    const statements = db
      .prepare(
        `SELECT * FROM pay_statements
         WHERE strftime('%Y', pay_date) = ?
         ORDER BY pay_date ASC`
      )
      .all(String(year)) as PayStatement[]

    // Calculate totals from statements
    const calculated = {
      grossEarnings: 0,
      totalTaxes: 0,
      totalDeductions: 0,
      employerBenefits: 0,
      netPay: 0,
    }

    for (const stmt of statements) {
      calculated.grossEarnings += stmt.gross_earnings
      calculated.totalTaxes += stmt.total_taxes
      calculated.totalDeductions += stmt.total_deductions
      calculated.employerBenefits += stmt.employer_benefits
      calculated.netPay += stmt.net_pay
    }

    // Get the last statement's YTD values
    const lastStmt = statements[statements.length - 1]
    const lastStubYtd = lastStmt ? {
      grossEarnings: lastStmt.ytd_gross_earnings,
      totalTaxes: lastStmt.ytd_total_taxes,
      totalDeductions: lastStmt.ytd_total_deductions,
      netPay: lastStmt.ytd_net_pay,
    } : {
      grossEarnings: null,
      totalTaxes: null,
      totalDeductions: null,
      netPay: null,
    }

    // Calculate discrepancies
    const discrepancies: DebugReport['discrepancies'] = []

    const comparisons = [
      { field: 'grossEarnings', calc: calculated.grossEarnings, ytd: lastStubYtd.grossEarnings },
      { field: 'totalTaxes', calc: calculated.totalTaxes, ytd: lastStubYtd.totalTaxes },
      { field: 'totalDeductions', calc: calculated.totalDeductions, ytd: lastStubYtd.totalDeductions },
      { field: 'netPay', calc: calculated.netPay, ytd: lastStubYtd.netPay },
    ]

    for (const { field, calc, ytd } of comparisons) {
      const diff = ytd !== null ? Math.round((calc - ytd) * 100) / 100 : null
      if (diff === null || Math.abs(diff) > 0.01) {
        discrepancies.push({
          field,
          calculated: Math.round(calc * 100) / 100,
          ytd,
          difference: diff,
        })
      }
    }

    // Find gaps in pay periods
    const gaps: DebugReport['gaps'] = []
    for (let i = 1; i < statements.length; i++) {
      const prev = statements[i - 1]
      const curr = statements[i]

      const prevEnd = new Date(prev.period_end)
      const currStart = new Date(curr.period_start)
      const daysDiff = Math.floor((currStart.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24))

      // If more than 3 days between period end and next period start, flag as gap
      if (daysDiff > 3) {
        gaps.push({
          after: prev.pay_date,
          before: curr.pay_date,
          daysMissing: daysDiff,
        })
      }
    }

    // Get item-level breakdown
    const itemBreakdown = db
      .prepare(
        `SELECT
          c.code as category_code,
          i.item_code,
          SUM(i.current_amount) as total,
          COUNT(*) as occurrences
         FROM pay_statement_items i
         JOIN pay_item_categories c ON i.category_id = c.id
         JOIN pay_statements s ON i.pay_statement_id = s.id
         WHERE strftime('%Y', s.pay_date) = ?
         GROUP BY c.code, i.item_code
         ORDER BY c.display_order, i.item_code`
      )
      .all(String(year)) as {
        category_code: string
        item_code: string
        total: number
        occurrences: number
      }[]

    // Per-statement details
    const statementDetails = statements.map(stmt => {
      const calculatedNet = stmt.gross_earnings - stmt.total_taxes - stmt.total_deductions
      return {
        id: stmt.id,
        payDate: stmt.pay_date,
        periodStart: stmt.period_start,
        periodEnd: stmt.period_end,
        grossEarnings: stmt.gross_earnings,
        totalTaxes: stmt.total_taxes,
        totalDeductions: stmt.total_deductions,
        netPay: stmt.net_pay,
        calculatedNet: Math.round(calculatedNet * 100) / 100,
        netDiscrepancy: Math.round((stmt.net_pay - calculatedNet) * 100) / 100,
      }
    })

    const report: DebugReport = {
      year,
      statementCount: statements.length,
      expectedCount: {
        biweekly: 26,
        semimonthly: 24,
      },
      dateRange: {
        first: statements[0]?.pay_date ?? null,
        last: lastStmt?.pay_date ?? null,
      },
      gaps,
      calculated: {
        grossEarnings: Math.round(calculated.grossEarnings * 100) / 100,
        totalTaxes: Math.round(calculated.totalTaxes * 100) / 100,
        totalDeductions: Math.round(calculated.totalDeductions * 100) / 100,
        employerBenefits: Math.round(calculated.employerBenefits * 100) / 100,
        netPay: Math.round(calculated.netPay * 100) / 100,
      },
      lastStubYtd,
      discrepancies,
      itemBreakdown: itemBreakdown.map(item => ({
        categoryCode: item.category_code,
        itemCode: item.item_code,
        total: Math.round(item.total * 100) / 100,
        occurrences: item.occurrences,
      })),
      statements: statementDetails,
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Failed to generate debug report:', error)
    return NextResponse.json(
      { error: 'Failed to generate debug report' },
      { status: 500 }
    )
  }
}
