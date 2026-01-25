import { NextRequest, NextResponse } from 'next/server'
import { parsePayStatementPdfWithLlm } from '@/lib/services/pdf/pay-statement-parser-llm'
import { getPayStatementById } from '@/lib/services/pay-statement'

/**
 * Re-parse a PDF and compare with stored data
 * POST /api/pay-statements/reparse
 * Body: FormData with 'file' field (PDF) and optional 'statementId' to compare
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const statementIdParam = formData.get('statementId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Parse the PDF
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await parsePayStatementPdfWithLlm(buffer, true) // debug=true

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'Failed to parse PDF' },
        { status: 400 }
      )
    }

    const parsed = result.data

    // Calculate what the parser computed
    const earningsItems = parsed.items.filter(i => i.categoryCode === 'earnings')
    const taxItems = parsed.items.filter(i => i.categoryCode === 'statutory_tax')
    const pretaxItems = parsed.items.filter(i => i.categoryCode === 'pretax_deduction')
    const posttaxItems = parsed.items.filter(i => i.categoryCode === 'posttax_deduction')
    const benefitItems = parsed.items.filter(i => i.categoryCode === 'employer_benefit')

    const analysis = {
      parsed: {
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        payDate: parsed.payDate,
        grossEarnings: parsed.grossEarnings,
        totalTaxes: parsed.totalTaxes,
        totalDeductions: parsed.totalDeductions,
        employerBenefits: parsed.employerBenefits,
        netPay: parsed.netPay,
        calculatedNet: Math.round((parsed.grossEarnings - parsed.totalTaxes - parsed.totalDeductions) * 100) / 100,
      },
      itemBreakdown: {
        earnings: earningsItems.map(i => ({ code: i.itemCode, name: i.itemName, amount: i.currentAmount, ytd: i.ytdAmount })),
        taxes: taxItems.map(i => ({ code: i.itemCode, name: i.itemName, amount: i.currentAmount, ytd: i.ytdAmount })),
        pretaxDeductions: pretaxItems.map(i => ({ code: i.itemCode, name: i.itemName, amount: i.currentAmount, ytd: i.ytdAmount })),
        posttaxDeductions: posttaxItems.map(i => ({ code: i.itemCode, name: i.itemName, amount: i.currentAmount, ytd: i.ytdAmount })),
        employerBenefits: benefitItems.map(i => ({ code: i.itemCode, name: i.itemName, amount: i.currentAmount, ytd: i.ytdAmount })),
      },
      sumVerification: {
        sumOfEarnings: earningsItems.reduce((s, i) => s + i.currentAmount, 0),
        sumOfTaxes: taxItems.reduce((s, i) => s + i.currentAmount, 0),
        sumOfPretax: pretaxItems.reduce((s, i) => s + i.currentAmount, 0),
        sumOfPosttax: posttaxItems.reduce((s, i) => s + i.currentAmount, 0),
        sumOfAllDeductions: pretaxItems.reduce((s, i) => s + i.currentAmount, 0) + posttaxItems.reduce((s, i) => s + i.currentAmount, 0),
      },
      deposits: parsed.deposits,
      fileHash: result.fileHash,
    }

    // If statementId provided, compare with stored data
    let comparison = null
    if (statementIdParam) {
      const statementId = parseInt(statementIdParam, 10)
      const stored = getPayStatementById(statementId)
      if (stored) {
        comparison = {
          stored: {
            grossEarnings: stored.gross_earnings,
            totalTaxes: stored.total_taxes,
            totalDeductions: stored.total_deductions,
            employerBenefits: stored.employer_benefits,
            netPay: stored.net_pay,
          },
          differences: {
            grossEarnings: Math.round((parsed.grossEarnings - stored.gross_earnings) * 100) / 100,
            totalTaxes: Math.round((parsed.totalTaxes - stored.total_taxes) * 100) / 100,
            totalDeductions: Math.round((parsed.totalDeductions - stored.total_deductions) * 100) / 100,
            netPay: Math.round((parsed.netPay - stored.net_pay) * 100) / 100,
          },
          storedItems: stored.items.map(i => ({
            categoryCode: i.category_code,
            itemCode: i.item_code,
            itemName: i.item_name,
            currentAmount: i.current_amount,
            ytdAmount: i.ytd_amount,
          })),
        }
      }
    }

    return NextResponse.json({ analysis, comparison })
  } catch (error) {
    console.error('Failed to reparse PDF:', error)
    return NextResponse.json(
      { error: 'Failed to reparse PDF' },
      { status: 500 }
    )
  }
}
