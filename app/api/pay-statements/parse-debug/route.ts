import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { pdf } from 'pdf-to-img'

// Extend timeout for LLM processing
export const maxDuration = 120

/**
 * POST /api/pay-statements/parse-debug
 * Debug endpoint that shows exactly what the LLM extracts from a pay stub PDF
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex')

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY environment variable is not set' },
        { status: 500 }
      )
    }

    // Convert PDF pages to images
    const pdfDocument = await pdf(buffer, { scale: 2.0 })
    const imageContents: Anthropic.ImageBlockParam[] = []
    let pageCount = 0

    for await (const page of pdfDocument) {
      const base64 = page.toString('base64')
      imageContents.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: base64,
        },
      })
      pageCount++
    }

    // Initialize Anthropic client
    const client = new Anthropic({ apiKey })

    // Simplified tool for raw extraction
    const extractTool: Anthropic.Tool = {
      name: 'extract_pay_statement',
      description: 'Extract all data from the pay stub',
      input_schema: {
        type: 'object' as const,
        properties: {
          periodStart: { type: 'string', description: 'Pay period start (YYYY-MM-DD)' },
          periodEnd: { type: 'string', description: 'Pay period end (YYYY-MM-DD)' },
          payDate: { type: 'string', description: 'Pay date (YYYY-MM-DD)' },
          grossEarnings: { type: 'number' },
          totalTaxes: { type: 'number' },
          totalDeductions: { type: 'number' },
          employerBenefits: { type: 'number' },
          netPay: { type: 'number' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                categoryCode: {
                  type: 'string',
                  enum: ['earnings', 'statutory_tax', 'pretax_deduction', 'posttax_deduction', 'employer_benefit', 'adjustment', 'rsu_withholding'],
                },
                itemCode: { type: 'string' },
                itemName: { type: 'string' },
                currentAmount: { type: 'number' },
                ytdAmount: { type: 'number' },
              },
              required: ['categoryCode', 'itemCode', 'itemName', 'currentAmount'],
            },
          },
          deposits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                accountType: { type: 'string' },
                accountLast4: { type: 'string' },
                amount: { type: 'number' },
              },
              required: ['accountType', 'amount'],
            },
          },
        },
        required: ['periodStart', 'periodEnd', 'payDate', 'grossEarnings', 'totalTaxes', 'totalDeductions', 'netPay', 'items', 'deposits'],
      },
    }

    const systemPrompt = `You are an expert at extracting data from ADP pay stub images. Extract ALL data exactly as shown.

DATES: Convert MM/DD/YYYY to YYYY-MM-DD format.

CATEGORIES:
- earnings: Regular salary, RSU vesting (Restricted Stock), bonuses, dividend equivalents, gym subsidies
- statutory_tax: Federal Income Tax, State Income Tax, Social Security Tax, Medicare Tax, Medicare Surtax
- pretax_deduction: 401k, Medical/Dental/Vision Pre-Tax, FSA
- posttax_deduction: MetLife Legal, other post-tax items
- employer_benefit: Employer Medical/Dental/Vision, Group Term Life, 401K Match
- adjustment: Expense Reimbursements
- rsu_withholding: The "RSU" line in deductions on RSU vesting stubs

CRITICAL:
- currentAmount = amount for THIS PAY PERIOD ONLY (the "Current" column)
- ytdAmount = year-to-date total (the "YTD" column)
- If current column is blank or $0, use 0 for currentAmount
- Extract ALL line items you can see, even if they have $0 current amount
- For deposits, extract the CURRENT period deposits, not YTD

Extract numbers exactly as shown on the stub.`

    // Call Claude API
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system: systemPrompt,
      tools: [extractTool],
      tool_choice: { type: 'tool', name: 'extract_pay_statement' },
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: 'Please extract ALL pay statement data from this ADP pay stub. Include every line item you can see.',
            },
          ],
        },
      ],
    })

    // Extract tool use result
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    if (!toolUseBlock) {
      return NextResponse.json({
        success: false,
        error: 'LLM did not return structured data',
        rawResponse: response.content,
        fileHash,
        pageCount,
      })
    }

    const extracted = toolUseBlock.input as Record<string, unknown>

    // Parse items if they're a string
    let items = extracted.items
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items)
      } catch {
        items = []
      }
    }

    // Parse deposits if they're a string
    let deposits = extracted.deposits
    if (typeof deposits === 'string') {
      try {
        deposits = JSON.parse(deposits)
      } catch {
        deposits = []
      }
    }

    // Group items by category for easier reading
    const itemsByCategory: Record<string, unknown[]> = {
      earnings: [],
      statutory_tax: [],
      pretax_deduction: [],
      posttax_deduction: [],
      employer_benefit: [],
      adjustment: [],
      rsu_withholding: [],
      unknown: [],
    }

    if (Array.isArray(items)) {
      for (const item of items) {
        const cat = item?.categoryCode || 'unknown'
        if (itemsByCategory[cat]) {
          itemsByCategory[cat].push(item)
        } else {
          itemsByCategory.unknown.push(item)
        }
      }
    }

    // Calculate what our parser would compute
    const earningsSum = Array.isArray(items)
      ? items.filter((i: { categoryCode?: string }) => i?.categoryCode === 'earnings')
          .reduce((sum: number, i: { currentAmount?: number }) => sum + (i?.currentAmount || 0), 0)
      : 0

    const taxesSum = Array.isArray(items)
      ? items.filter((i: { categoryCode?: string }) => i?.categoryCode === 'statutory_tax')
          .reduce((sum: number, i: { currentAmount?: number }) => sum + (i?.currentAmount || 0), 0)
      : 0

    const deductionsSum = Array.isArray(items)
      ? items.filter((i: { categoryCode?: string }) =>
            i?.categoryCode === 'pretax_deduction' || i?.categoryCode === 'posttax_deduction')
          .reduce((sum: number, i: { currentAmount?: number }) => sum + (i?.currentAmount || 0), 0)
      : 0

    const adjustmentsSum = Array.isArray(items)
      ? items.filter((i: { categoryCode?: string }) => i?.categoryCode === 'adjustment')
          .reduce((sum: number, i: { currentAmount?: number }) => sum + (i?.currentAmount || 0), 0)
      : 0

    const depositsSum = Array.isArray(deposits)
      ? deposits.reduce((sum: number, d: { amount?: number }) => sum + (d?.amount || 0), 0)
      : 0

    const calculatedNetPay = earningsSum - taxesSum - deductionsSum + adjustmentsSum

    return NextResponse.json({
      success: true,
      fileHash,
      pageCount,

      // Raw LLM extraction
      llmExtracted: {
        periodStart: extracted.periodStart,
        periodEnd: extracted.periodEnd,
        payDate: extracted.payDate,
        grossEarnings: extracted.grossEarnings,
        totalTaxes: extracted.totalTaxes,
        totalDeductions: extracted.totalDeductions,
        employerBenefits: extracted.employerBenefits,
        netPay: extracted.netPay,
      },

      // Items grouped by category
      itemsByCategory,

      // Raw items array
      rawItems: items,

      // Deposits
      deposits,

      // Calculated values (what our parser would compute)
      calculated: {
        earningsSum: Math.round(earningsSum * 100) / 100,
        taxesSum: Math.round(taxesSum * 100) / 100,
        deductionsSum: Math.round(deductionsSum * 100) / 100,
        adjustmentsSum: Math.round(adjustmentsSum * 100) / 100,
        depositsSum: Math.round(depositsSum * 100) / 100,
        calculatedNetPay: Math.round(calculatedNetPay * 100) / 100,
      },

      // Discrepancies
      discrepancies: {
        grossEarnings: {
          llm: extracted.grossEarnings,
          calculated: Math.round(earningsSum * 100) / 100,
          diff: Math.round(((extracted.grossEarnings as number) - earningsSum) * 100) / 100,
        },
        totalTaxes: {
          llm: extracted.totalTaxes,
          calculated: Math.round(taxesSum * 100) / 100,
          diff: Math.round(((extracted.totalTaxes as number) - taxesSum) * 100) / 100,
        },
        totalDeductions: {
          llm: extracted.totalDeductions,
          calculated: Math.round(deductionsSum * 100) / 100,
          diff: Math.round(((extracted.totalDeductions as number) - deductionsSum) * 100) / 100,
        },
        netPay: {
          llm: extracted.netPay,
          calculated: Math.round(calculatedNetPay * 100) / 100,
          diff: Math.round(((extracted.netPay as number) - calculatedNetPay) * 100) / 100,
        },
        deposits: {
          netPay: extracted.netPay,
          depositsSum: Math.round(depositsSum * 100) / 100,
          diff: Math.round(((extracted.netPay as number) - depositsSum) * 100) / 100,
        },
      },

      // API usage
      usage: response.usage,
    })
  } catch (error) {
    console.error('Parse debug failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
