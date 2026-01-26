import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import { pdf } from 'pdf-to-img'

export interface ParsedRsuTransaction {
  vestDate: string
  saleDate: string
  shares: number
  vestPrice: number // FMV at vest (cost basis / shares)
  salePrice: number // Proceeds / shares
  grossProceeds: number
  costBasis: number // Adjusted cost basis
  capitalGainLoss: number
  grantId: string | null
  hasWashSale: boolean
  termType: 'short' | 'long' | null
}

export interface ParsedRsuDocument {
  documentType: 'supplement' | '1099b' | 'unknown'
  taxYear: number | null
  transactions: ParsedRsuTransaction[]
  totals: {
    totalShares: number
    totalProceeds: number
    totalCostBasis: number
    totalGainLoss: number
  }
}

export interface ParseResult {
  success: boolean
  data?: ParsedRsuDocument
  error?: string
  fileHash: string
  rawText?: string
}

// Tool definition for structured output
const extractRsuTransactionsTool: Anthropic.Tool = {
  name: 'extract_rsu_transactions',
  description: 'Extract RSU transaction data from E*Trade Stock Plan Supplement or 1099-B',
  input_schema: {
    type: 'object' as const,
    properties: {
      documentType: {
        type: 'string',
        enum: ['supplement', '1099b', 'unknown'],
        description: 'Type of document: supplement (Stock Plan Transactions Supplement) or 1099b',
      },
      taxYear: {
        type: 'number',
        description: 'Tax year for the document (e.g., 2024)',
      },
      transactions: {
        type: 'array',
        description: 'Array of RSU sale transactions',
        items: {
          type: 'object',
          properties: {
            vestDate: {
              type: 'string',
              description: 'Date shares were acquired/vested in YYYY-MM-DD format (Date Acquired column)',
            },
            saleDate: {
              type: 'string',
              description: 'Date shares were sold in YYYY-MM-DD format (Date Sold column)',
            },
            shares: {
              type: 'number',
              description: 'Number of shares sold (Qty column)',
            },
            grossProceeds: {
              type: 'number',
              description: 'Total sale proceeds before any adjustments (Proceeds column)',
            },
            costBasis: {
              type: 'number',
              description: 'REQUIRED: The cost basis from the "Adjusted Cost Basis" or "Cost Basis" column. This is the FMV at vest time × shares. Must be a positive number for every transaction - never 0 or empty. Look carefully at each table row.',
            },
            capitalGainLoss: {
              type: 'number',
              description: 'Capital gain or loss (Gain/Loss column). Negative for losses.',
            },
            grantId: {
              type: 'string',
              description: 'Grant number or ID if shown (often at end of row)',
            },
            hasWashSale: {
              type: 'boolean',
              description: 'True if row has WS indicator for wash sale',
            },
            termType: {
              type: 'string',
              enum: ['short', 'long', 'unknown'],
              description: 'Short-term or long-term holding period',
            },
          },
          required: ['vestDate', 'saleDate', 'shares', 'grossProceeds', 'costBasis'],
        },
      },
    },
    required: ['documentType', 'transactions'],
  },
}

const SYSTEM_PROMPT = `You are an expert at extracting RSU (Restricted Stock Unit) transaction data from E*Trade tax documents.

DOCUMENT TYPES:
1. Stock Plan Transactions Supplement - Detailed breakdown of RSU sales with cost basis
2. 1099-B - IRS form showing proceeds from sales

CRITICAL REQUIREMENTS:
- Extract ALL transactions shown across ALL pages
- EVERY transaction MUST have a non-zero costBasis value
- If you see a table with multiple rows, extract EACH row as a separate transaction

DATE FORMAT: Always convert dates to YYYY-MM-DD format.
- Input: 01/15/2024 → Output: 2024-01-15
- Input: 1/5/2024 → Output: 2024-01-05

TRANSACTION COLUMNS (Stock Plan Supplement):
The document typically shows these columns in a table:
| Symbol | Qty | Date Acquired | Date Sold | Proceeds | Cost Basis | Adj | Adj Cost Basis | Gain/Loss | Term | Covered | Type | Grant# |

Column meanings:
- Qty = number of shares sold (extract as "shares")
- Date Acquired = vest date when shares were received
- Date Sold = sale date
- Proceeds = gross sale proceeds (extract as "grossProceeds")
- Cost Basis or Adjusted Cost Basis = FMV at vest × shares (extract as "costBasis")
- Gain/Loss = capital gain or loss (extract as "capitalGainLoss")
- Grant# = grant identifier like B17868 (extract as "grantId")

COST BASIS IS CRITICAL:
- The "Cost Basis" or "Adjusted Cost Basis" column shows the tax basis (FMV at vest × shares)
- This value is REQUIRED for every transaction - it should NEVER be 0 or empty
- Look carefully at each row in the table - the cost basis is typically a dollar amount similar in magnitude to the proceeds
- For RSUs, cost basis represents what the shares were worth when they vested

EXAMPLE: A row might show:
INTU | 7.000 | 01/01/2024 | 01/04/2024 | $4,375.80 | $4,268.95 | $0 | $4,268.95 | $106.85 | Short | Covered | RSU | B17868

From this extract:
- shares: 7.0
- vestDate: 2024-01-01
- saleDate: 2024-01-04
- grossProceeds: 4375.80
- costBasis: 4268.95 (use Adjusted Cost Basis if available, otherwise Cost Basis)
- capitalGainLoss: 106.85
- grantId: B17868

IMPORTANT NOTES:
1. Each row in the table is a separate transaction - extract ALL rows
2. Multiple rows may have the same vest date (different grants vesting same day)
3. Wash sale rows marked "WS" have adjustment values
4. Losses shown in parentheses or with minus sign are negative
5. The document may span multiple pages - look at ALL pages
6. Do NOT skip any rows - every transaction row must be extracted

Extract every transaction row showing stock sales.`

/**
 * Parse E*Trade RSU document (Supplement or 1099-B) using Claude LLM
 */
export async function parseRsuDocumentWithLlm(
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
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [extractRsuTransactionsTool],
      tool_choice: { type: 'tool', name: 'extract_rsu_transactions' },
      messages: [
        {
          role: 'user',
          content: [
            ...imageContents,
            {
              type: 'text',
              text: 'Please extract all RSU transaction data from this E*Trade document. Include every transaction row showing stock sales.',
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
      documentType: 'supplement' | '1099b' | 'unknown'
      taxYear?: number
      transactions: Array<{
        vestDate: string
        saleDate: string
        shares: number
        grossProceeds: number
        costBasis: number
        capitalGainLoss?: number
        grantId?: string
        hasWashSale?: boolean
        termType?: 'short' | 'long' | 'unknown'
      }>
    }

    // Process and validate transactions
    const transactions: ParsedRsuTransaction[] = (rawExtracted.transactions || [])
      .filter(tx => tx && tx.vestDate && tx.saleDate && tx.shares > 0)
      .map(tx => {
        const shares = tx.shares
        const grossProceeds = tx.grossProceeds || 0
        const costBasis = tx.costBasis || 0
        const capitalGainLoss = tx.capitalGainLoss ?? (grossProceeds - costBasis)

        return {
          vestDate: normalizeDate(tx.vestDate),
          saleDate: normalizeDate(tx.saleDate),
          shares,
          vestPrice: shares > 0 ? costBasis / shares : 0,
          salePrice: shares > 0 ? grossProceeds / shares : 0,
          grossProceeds,
          costBasis,
          capitalGainLoss,
          grantId: tx.grantId || null,
          hasWashSale: tx.hasWashSale || false,
          termType: tx.termType === 'short' || tx.termType === 'long' ? tx.termType : null,
        }
      })

    // Calculate totals
    const totals = {
      totalShares: transactions.reduce((sum, tx) => sum + tx.shares, 0),
      totalProceeds: transactions.reduce((sum, tx) => sum + tx.grossProceeds, 0),
      totalCostBasis: transactions.reduce((sum, tx) => sum + tx.costBasis, 0),
      totalGainLoss: transactions.reduce((sum, tx) => sum + tx.capitalGainLoss, 0),
    }

    const document: ParsedRsuDocument = {
      documentType: rawExtracted.documentType || 'unknown',
      taxYear: rawExtracted.taxYear || null,
      transactions,
      totals,
    }

    // Include raw LLM output for debugging
    const rawText = JSON.stringify(rawExtracted, null, 2)

    return { success: true, data: document, fileHash, rawText }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error parsing PDF'
    return { success: false, error: message, fileHash }
  }
}

/**
 * Normalize date string to YYYY-MM-DD format
 */
function normalizeDate(dateStr: string): string {
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }

  // MM/DD/YYYY format
  const mdyMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdyMatch) {
    const [, month, day, year] = mdyMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // Try to parse with Date
  const date = new Date(dateStr)
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0]
  }

  return dateStr
}

/**
 * Generate a file hash for duplicate detection
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Consolidate transactions by vest date and sale date
 * Groups multiple transactions from the same vest period
 */
export function consolidateTransactions(transactions: ParsedRsuTransaction[]): ParsedRsuTransaction[] {
  const byKey: Record<string, ParsedRsuTransaction[]> = {}

  for (const tx of transactions) {
    const key = `${tx.vestDate}-${tx.saleDate}`
    if (!byKey[key]) byKey[key] = []
    byKey[key].push(tx)
  }

  return Object.values(byKey).map(group => {
    const totalShares = group.reduce((sum, tx) => sum + tx.shares, 0)
    const totalProceeds = group.reduce((sum, tx) => sum + tx.grossProceeds, 0)
    const totalCostBasis = group.reduce((sum, tx) => sum + tx.costBasis, 0)
    const totalGainLoss = group.reduce((sum, tx) => sum + tx.capitalGainLoss, 0)
    const grantIds = [...new Set(group.map(tx => tx.grantId).filter(Boolean))]
    const hasWashSale = group.some(tx => tx.hasWashSale)
    const termType = group[0].termType // Assume same term for consolidated

    return {
      vestDate: group[0].vestDate,
      saleDate: group[0].saleDate,
      shares: totalShares,
      vestPrice: totalCostBasis / totalShares,
      salePrice: totalProceeds / totalShares,
      grossProceeds: totalProceeds,
      costBasis: totalCostBasis,
      capitalGainLoss: totalGainLoss,
      grantId: grantIds.join(', ') || null,
      hasWashSale,
      termType,
    }
  }).sort((a, b) => new Date(a.vestDate).getTime() - new Date(b.vestDate).getTime())
}

/**
 * Merge transactions from multiple document sources (1099-B and Supplement)
 *
 * IMPORTANT: When Supplement is available, use it exclusively.
 * The Stock Plan Transactions Supplement has:
 * - Accurate share counts
 * - Proper cost basis (adjusted for RSU income)
 * - Grant IDs for each transaction
 *
 * The 1099-B often has issues with share parsing and shows $0 cost basis
 * (since brokers report cost basis differently for RSUs).
 *
 * We do NOT deduplicate by date because multiple grants can vest/sell
 * on the same day with the same amounts.
 */
export function mergeDocumentTransactions(
  documents: ParsedRsuDocument[]
): ParsedRsuTransaction[] {
  // Separate by document type
  const supplementTxs: ParsedRsuTransaction[] = []
  const otherTxs: ParsedRsuTransaction[] = []

  for (const doc of documents) {
    if (doc.documentType === 'supplement') {
      supplementTxs.push(...doc.transactions)
    } else {
      otherTxs.push(...doc.transactions)
    }
  }

  // If Supplement data is available, use it exclusively
  // Supplement has accurate cost basis, shares, and grant IDs
  if (supplementTxs.length > 0) {
    // Return all supplement transactions without consolidation
    // Multiple grants can have the same vest/sale dates
    return supplementTxs.sort((a, b) =>
      new Date(a.vestDate).getTime() - new Date(b.vestDate).getTime()
    )
  }

  // Fallback to 1099-B data only if no Supplement available
  // Note: 1099-B may have parsing issues (share counts, $0 cost basis)
  return otherTxs.sort((a, b) =>
    new Date(a.vestDate).getTime() - new Date(b.vestDate).getTime()
  )
}
