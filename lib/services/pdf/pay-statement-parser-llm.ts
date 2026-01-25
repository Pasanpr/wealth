import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { pdf } from 'pdf-to-img'
import {
  ParsedPayStatement,
  ParsedPayItem,
  ParsedDeposit,
  PayItemCategoryCode,
} from '@/lib/types'

interface ParseResult {
  success: boolean
  data?: ParsedPayStatement
  error?: string
  fileHash: string
  rawText?: string
}

// Tool definition for structured output
const extractPayStatementTool: Anthropic.Tool = {
  name: 'extract_pay_statement',
  description: 'Extract structured pay statement data from ADP paycheck text',
  input_schema: {
    type: 'object' as const,
    properties: {
      periodStart: {
        type: 'string',
        description: 'Pay period start date in YYYY-MM-DD format',
      },
      periodEnd: {
        type: 'string',
        description: 'Pay period end date in YYYY-MM-DD format',
      },
      payDate: {
        type: 'string',
        description: 'Pay date in YYYY-MM-DD format',
      },
      grossEarnings: {
        type: 'number',
        description: 'Total gross earnings for this pay period',
      },
      totalTaxes: {
        type: 'number',
        description: 'Total taxes withheld for this pay period',
      },
      totalDeductions: {
        type: 'number',
        description: 'Total deductions (pre-tax + post-tax) for this pay period',
      },
      employerBenefits: {
        type: 'number',
        description: 'Total employer-paid benefits for this pay period',
      },
      netPay: {
        type: 'number',
        description: 'Net pay (take-home amount) for this pay period',
      },
      items: {
        type: 'array',
        description: 'All line items from the pay statement',
        items: {
          type: 'object',
          properties: {
            categoryCode: {
              type: 'string',
              enum: ['earnings', 'statutory_tax', 'pretax_deduction', 'posttax_deduction', 'employer_benefit', 'adjustment', 'rsu_withholding'],
              description: 'Category of the line item. Use "adjustment" for expense reimbursements that add back to net pay. Use "rsu_withholding" for the RSU line on RSU vesting stubs (shares withheld for taxes).',
            },
            itemCode: {
              type: 'string',
              description: 'Short code for the item (e.g., REGULAR, FED_TAX, MEDICARE, 401K_PRETAX)',
            },
            itemName: {
              type: 'string',
              description: 'Display name for the item',
            },
            currentAmount: {
              type: 'number',
              description: 'Amount for this pay period (always positive)',
            },
            ytdAmount: {
              type: 'number',
              description: 'Year-to-date amount if available',
            },
            hours: {
              type: 'number',
              description: 'Hours worked if applicable',
            },
            rate: {
              type: 'number',
              description: 'Hourly rate if applicable',
            },
          },
          required: ['categoryCode', 'itemCode', 'itemName', 'currentAmount'],
        },
      },
      deposits: {
        type: 'array',
        description: 'Direct deposit information',
        items: {
          type: 'object',
          properties: {
            accountType: {
              type: 'string',
              description: 'Account type (checking, savings)',
            },
            accountLast4: {
              type: 'string',
              description: 'Last 4 digits of account number if shown',
            },
            amount: {
              type: 'number',
              description: 'Deposit amount',
            },
          },
          required: ['accountType', 'amount'],
        },
      },
    },
    required: [
      'periodStart',
      'periodEnd',
      'payDate',
      'grossEarnings',
      'totalTaxes',
      'totalDeductions',
      'employerBenefits',
      'netPay',
      'items',
      'deposits',
    ],
  },
}

const SYSTEM_PROMPT = `You are an expert at extracting data from ADP pay stub images. Extract all pay statement data accurately.

DATES: Convert MM/DD/YYYY to YYYY-MM-DD format.

DETECTING RSU VESTING STUBS:
An RSU vesting stub has these characteristics:
- Period start and end are the SAME DATE (single day)
- Large "Restricted Stock" earning (often $50k+)
- Net Pay is $0 (you receive shares, not cash)
- Has an "RSU" line in deductions representing share withholding

CATEGORIES:
- earnings: Regular salary, RSU vesting (Restricted Stock), bonuses, dividend equivalents, gym subsidies
- statutory_tax: Federal Income Tax, State Income Tax, Social Security Tax, Medicare Tax, Medicare Surtax
- pretax_deduction: 401k, Medical/Dental/Vision Pre-Tax, FSA
- posttax_deduction: MetLife Legal, other post-tax items (NOT RSU on RSU vesting stubs - see below)
- employer_benefit: Employer Medical/Dental/Vision, Group Term Life, 401K Match
- adjustment: Expense Reimbursements, Travel Reimbursements, Mileage, or any "Imputed" adjustments that ADD to net pay. DO NOT include "PTO Available", "Sick Available", "Vacation Available" or similar balance/hours information - these are informational only and do not affect pay
- rsu_withholding: The "RSU" line on RSU vesting stubs (shares withheld for taxes)

ITEM CODES (use these standard codes):
- Earnings: REGULAR, RSU_VEST, BONUS, DIV_EQV, GYM_SUBSIDY
- Taxes: FED_TAX, STATE_TAX, SOC_SEC, MEDICARE, MEDICARE_SURTAX
- Pre-tax: 401K_PRETAX, MEDICAL, DENTAL, VISION, FSA_HEALTH
- Post-tax: LEGAL
- RSU Withholding: RSU_WITHHOLDING (only for the "RSU" line on RSU vesting stubs)
- Benefits: MEDICAL_ER, DENTAL_ER, VISION_ER, LIFE_INS_ER, 401K_MATCH
- Adjustments: EXPENSE_REIMB, TRAVEL_REIMB, MILEAGE_REIMB, IMPUTED_ADJ

CRITICAL - EXPENSE REIMBURSEMENTS / ADJUSTMENTS:
On ADP pay stubs, expense reimbursements appear in different places:
- Look for sections labeled "Other Adjustments", "Imputed/Memo Items", or "Reimbursements"
- May appear near the bottom of the stub, separate from regular earnings
- Common labels: "Expense Reimbursement", "Travel Reimb", "Mileage", "Expense Reimb", "ExpenseRe"
- These amounts ADD to net pay (not subtracted like deductions)
- If you see Net Pay that doesn't match gross - taxes - deductions, look for reimbursements!
- Reimbursements explain the difference: NetPay = Gross - Taxes - Deductions + Adjustments
- DO NOT INCLUDE as adjustments: "PTO Available", "Sick Available", "Vacation Balance", "Hours Available" - these are informational balance displays, not pay items. Skip them entirely.

CRITICAL - RSU VESTING STUB HANDLING:
On RSU vesting stubs, the "RSU" line in deductions is SPECIAL:
- It represents the value of shares withheld to pay taxes
- It should use categoryCode "rsu_withholding" (NOT posttax_deduction)
- It should use itemCode "RSU_WITHHOLDING"
- The taxes shown (FED_TAX, STATE_TAX, etc.) are INCLUDED in this RSU withholding
- DO NOT double-count: totalDeductions should NOT include RSU_WITHHOLDING

CRITICAL - CURRENT VS YTD AMOUNTS:
- currentAmount = the amount for THIS PAY PERIOD ONLY (the "Current" column)
- ytdAmount = the year-to-date total (the "YTD" column)
- These are DIFFERENT values - do not confuse them
- If the current column shows blank or $0, use 0 for currentAmount
- On RSU vesting stubs, most non-RSU items will have $0 currentAmount but non-zero ytdAmount

IMPORTANT:
- All currentAmount values should be POSITIVE numbers
- grossEarnings = sum of all earnings items for this period
- totalTaxes = sum of all statutory_tax items for this period
- totalDeductions = sum of all pretax_deduction + posttax_deduction items (EXCLUDING rsu_withholding)
- Look for "Net Pay" value on the stub
- Deposits are listed as "Checking 1", "Checking 2", etc. with amounts
- ALWAYS look for expense reimbursements/adjustments - they are often overlooked!

Extract numbers exactly as shown. If a value shows $0 or is blank for this period, use 0.`

/**
 * Parse an ADP pay stub PDF using Claude LLM for extraction
 */
export async function parsePayStatementPdfWithLlm(
  pdfBuffer: Buffer,
  debug: boolean = false
): Promise<ParseResult> {
  const fileHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')

  try {
    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return {
        success: false,
        error: 'ANTHROPIC_API_KEY environment variable is not set',
        fileHash,
      }
    }

    // Convert PDF pages to images
    const pdfDocument = await pdf(pdfBuffer, { scale: 2.0 })
    const imageContents: Anthropic.ImageBlockParam[] = []

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
    }

    if (debug) {
      console.log(`=== Converted ${imageContents.length} PDF page(s) to images ===`)
    }

    // Initialize Anthropic client
    const client = new Anthropic({ apiKey })

    // Call Claude API with images and tool use for structured output
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [extractPayStatementTool],
      tool_choice: { type: 'tool', name: 'extract_pay_statement' },
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: 'Please extract all pay statement data from this ADP pay stub image(s).',
            },
          ],
        },
      ],
    })

    if (debug) {
      console.log('=== LLM RESPONSE ===')
      console.log(JSON.stringify(response, null, 2))
      console.log('=== END LLM RESPONSE ===')
    }

    // Extract tool use result
    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    )

    if (!toolUseBlock) {
      console.error('No tool_use block found in response:', JSON.stringify(response.content))
      return {
        success: false,
        error: 'LLM did not return structured data',
        fileHash,
      }
    }

    if (!toolUseBlock.input) {
      console.error('Tool use block has no input:', JSON.stringify(toolUseBlock))
      return {
        success: false,
        error: 'LLM returned empty tool input',
        fileHash,
      }
    }

    const rawExtracted = toolUseBlock.input as {
      periodStart: string
      periodEnd: string
      payDate: string
      grossEarnings: number
      totalTaxes: number
      totalDeductions: number
      employerBenefits: number
      netPay: number
      items: string | Array<{
        categoryCode: PayItemCategoryCode
        itemCode: string
        itemName: string
        currentAmount: number
        ytdAmount?: number
        hours?: number
        rate?: number
      }>
      deposits: string | Array<{
        accountType: string
        accountLast4?: string
        amount: number
      }>
    }

    // Handle case where LLM returns items/deposits as JSON strings instead of arrays
    // Also handle malformed output where LLM mixes in XML-like syntax
    let items: Array<{
      categoryCode: PayItemCategoryCode
      itemCode: string
      itemName: string
      currentAmount: number
      ytdAmount?: number
      hours?: number
      rate?: number
    }> = []
    let deposits: Array<{
      accountType: string
      accountLast4?: string
      amount: number
    }> = []

    // Sometimes the LLM embeds deposits in the items string with XML-like syntax
    let embeddedDepositsStr: string | null = null

    try {
      const rawItems = rawExtracted.items
      if (!rawItems) {
        items = []
      } else if (typeof rawItems === 'string') {
        let itemsStr = rawItems

        // Check for embedded deposits with XML-like syntax: ],\n<parameter name="deposits">[...]
        const parameterMatch = itemsStr.match(/<parameter\s+name="deposits">\s*(\[[\s\S]*?\])\s*"?$/)
        if (parameterMatch) {
          embeddedDepositsStr = parameterMatch[1]
          // Remove the embedded deposits from items string
          itemsStr = itemsStr.substring(0, itemsStr.indexOf('<parameter'))
        }

        // Check for embedded deposits as JSON property: ],\n  "deposits": [...]
        const jsonDepositsMatch = itemsStr.match(/\],\s*"deposits"\s*:\s*(\[[\s\S]*?\])\s*$/)
        if (jsonDepositsMatch) {
          embeddedDepositsStr = jsonDepositsMatch[1]
          // Remove the embedded deposits - find the last ] before "deposits"
          const depositsKeyIndex = itemsStr.lastIndexOf('"deposits"')
          if (depositsKeyIndex !== -1) {
            // Find the ] that ends the items array (before the comma and "deposits")
            itemsStr = itemsStr.substring(0, depositsKeyIndex)
            // Remove trailing comma and whitespace
            itemsStr = itemsStr.replace(/,\s*$/, '')
          }
        }

        // Clean up - find the actual array
        const startBracket = itemsStr.indexOf('[')
        const endBracket = itemsStr.lastIndexOf(']')
        if (startBracket !== -1 && endBracket !== -1) {
          itemsStr = itemsStr.substring(startBracket, endBracket + 1)
        }

        // Remove trailing commas before closing bracket
        itemsStr = itemsStr.replace(/,\s*\]/, ']')

        items = JSON.parse(itemsStr) || []
      } else if (Array.isArray(rawItems)) {
        items = rawItems
      } else {
        items = []
      }
    } catch (e) {
      console.error('Failed to parse items:', rawExtracted.items, e)
      items = []
    }

    try {
      // First try the embedded deposits, then fall back to rawExtracted.deposits
      const depositsSource = embeddedDepositsStr || rawExtracted.deposits

      if (!depositsSource) {
        deposits = []
      } else if (typeof depositsSource === 'string') {
        let depositsStr = depositsSource
        // Extract just the array portion
        const startBracket = depositsStr.indexOf('[')
        const endBracket = depositsStr.lastIndexOf(']')
        if (startBracket !== -1 && endBracket !== -1) {
          depositsStr = depositsStr.substring(startBracket, endBracket + 1)
        }
        deposits = JSON.parse(depositsStr) || []
      } else if (Array.isArray(depositsSource)) {
        deposits = depositsSource
      } else {
        deposits = []
      }
    } catch (e) {
      console.error('Failed to parse deposits:', rawExtracted.deposits, e)
      deposits = []
    }

    // Ensure items and deposits are arrays and filter out any null/undefined entries
    if (!Array.isArray(items)) {
      console.error('Items is not an array after parsing:', items, 'raw:', rawExtracted.items)
      items = []
    }
    items = items.filter((item): item is NonNullable<typeof item> => item != null && typeof item === 'object')

    if (!Array.isArray(deposits)) {
      console.error('Deposits is not an array after parsing:', deposits, 'raw:', rawExtracted.deposits)
      deposits = []
    }
    deposits = deposits.filter((d): d is NonNullable<typeof d> => d != null && typeof d === 'object')

    if (debug) {
      console.log(`Parsed ${items.length} items and ${deposits.length} deposits`)
    }

    // Map items to ParsedPayItem
    const allParsedItems: ParsedPayItem[] = items
      .filter(item => item && item.categoryCode && item.itemCode)
      .map((item: { categoryCode: PayItemCategoryCode; itemCode: string; itemName: string; currentAmount: number; ytdAmount?: number; hours?: number; rate?: number }): ParsedPayItem => ({
        categoryCode: item.categoryCode,
        itemCode: item.itemCode,
        itemName: item.itemName || 'Unknown',
        currentAmount: item.currentAmount || 0,
        ytdAmount: item.ytdAmount,
        hours: item.hours,
        rate: item.rate,
      }))

    // Detect RSU vesting stubs: same start/end date, has RSU_VEST earning, net pay is 0
    const isRsuVestingStub =
      rawExtracted.periodStart === rawExtracted.periodEnd &&
      allParsedItems.some(i => i.itemCode === 'RSU_VEST' && i.currentAmount > 0) &&
      rawExtracted.netPay === 0

    // Log RSU withholding for debugging (informational, not stored)
    const rsuWithholdingItems = allParsedItems.filter(i => i.categoryCode === 'rsu_withholding')
    if (rsuWithholdingItems.length > 0 && debug) {
      console.log('RSU withholding (informational, excluded from deductions):', rsuWithholdingItems)
    }

    // Fallback: If LLM didn't use rsu_withholding category but this is an RSU stub,
    // reclassify RSU_TAX items to rsu_withholding so they're excluded from deductions
    let itemsToProcess = allParsedItems
    if (isRsuVestingStub) {
      const rsuTaxInDeductions = allParsedItems.filter(
        i => (i.itemCode === 'RSU_TAX' || i.itemCode === 'RSU') &&
             (i.categoryCode === 'pretax_deduction' || i.categoryCode === 'posttax_deduction')
      )
      if (rsuTaxInDeductions.length > 0) {
        if (debug) {
          console.log('RSU stub detected - reclassifying RSU_TAX from deductions to rsu_withholding:', rsuTaxInDeductions)
        }
        // Reclassify these items
        itemsToProcess = allParsedItems.map(i => {
          if ((i.itemCode === 'RSU_TAX' || i.itemCode === 'RSU') &&
              (i.categoryCode === 'pretax_deduction' || i.categoryCode === 'posttax_deduction')) {
            return { ...i, categoryCode: 'rsu_withholding' as PayItemCategoryCode, itemCode: 'RSU_WITHHOLDING' }
          }
          return i
        })
      }
    }

    // Filter out rsu_withholding - it's informational only and doesn't have a DB category
    // RSU_WITHHOLDING represents shares withheld for taxes, which are already counted in statutory_tax
    let parsedItems = itemsToProcess.filter(i => i.categoryCode !== 'rsu_withholding')

    // Post-process: Recategorize misclassified expense reimbursements
    // Sometimes the LLM puts expense reimbursements in deductions instead of adjustments
    // Reimbursements have positive amounts and ADD to net pay, so they should be adjustments
    const reimbursementKeywords = ['reimb', 'expense', 'travel', 'mileage', 'imputed', 'offset']
    parsedItems = parsedItems.map(item => {
      // Check if this looks like a reimbursement that was miscategorized as a deduction
      const isDeduction = item.categoryCode === 'pretax_deduction' || item.categoryCode === 'posttax_deduction'
      const lowerName = item.itemName.toLowerCase()
      const lowerCode = item.itemCode.toLowerCase()
      const looksLikeReimbursement = reimbursementKeywords.some(
        kw => lowerName.includes(kw) || lowerCode.includes(kw)
      )

      if (isDeduction && looksLikeReimbursement && item.currentAmount > 0) {
        if (debug) {
          console.log(`Recategorizing "${item.itemName}" from ${item.categoryCode} to adjustment`)
        }
        return { ...item, categoryCode: 'adjustment' as PayItemCategoryCode }
      }
      return item
    })

    // Calculate totals from line items when available
    const calcGrossEarnings = parsedItems
      .filter(i => i.categoryCode === 'earnings')
      .reduce((sum, i) => sum + i.currentAmount, 0)

    const calcTotalTaxes = parsedItems
      .filter(i => i.categoryCode === 'statutory_tax')
      .reduce((sum, i) => sum + i.currentAmount, 0)

    const calcTotalDeductions = parsedItems
      .filter(i => i.categoryCode === 'pretax_deduction' || i.categoryCode === 'posttax_deduction')
      .reduce((sum, i) => sum + i.currentAmount, 0)

    const calcEmployerBenefits = parsedItems
      .filter(i => i.categoryCode === 'employer_benefit')
      .reduce((sum, i) => sum + i.currentAmount, 0)

    // Use calculated totals if items were parsed successfully, otherwise fall back to LLM's extracted totals
    const itemsParsedSuccessfully = parsedItems.length > 0
    const grossEarnings = itemsParsedSuccessfully ? calcGrossEarnings : (rawExtracted.grossEarnings || 0)
    const totalTaxes = itemsParsedSuccessfully ? calcTotalTaxes : (rawExtracted.totalTaxes || 0)
    const totalDeductions = itemsParsedSuccessfully ? calcTotalDeductions : (rawExtracted.totalDeductions || 0)
    const employerBenefits = itemsParsedSuccessfully ? calcEmployerBenefits : (rawExtracted.employerBenefits || 0)

    // Map to ParsedPayStatement
    const statement: ParsedPayStatement = {
      periodStart: rawExtracted.periodStart,
      periodEnd: rawExtracted.periodEnd,
      payDate: rawExtracted.payDate,
      sourceType: 'adp',
      grossEarnings,
      totalTaxes,
      totalDeductions,
      employerBenefits,
      netPay: rawExtracted.netPay, // Trust the LLM for net pay (it's printed on the check)
      items: parsedItems,
      deposits: deposits
        .filter(d => d && d.accountType)
        .map((deposit: { accountType: string; accountLast4?: string; amount: number }): ParsedDeposit => ({
          accountType: deposit.accountType,
          accountLast4: deposit.accountLast4,
          amount: deposit.amount || 0,
        })),
    }

    // Include raw LLM output for debugging
    const rawText = JSON.stringify(rawExtracted, null, 2)

    return { success: true, data: statement, fileHash, rawText }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error parsing PDF'
    return { success: false, error: message, fileHash }
  }
}

/**
 * Generate a file hash for duplicate detection
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}
