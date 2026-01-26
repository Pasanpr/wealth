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
              description: 'Adjusted cost basis - the FMV at vest time (Adjusted Cost Basis column if available, otherwise Cost Basis)',
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

CRITICAL: Extract ALL transactions shown. These documents may have multiple pages.

DATE FORMAT: Always convert dates to YYYY-MM-DD format.
- Input: 01/15/2024 → Output: 2024-01-15
- Input: 1/5/2024 → Output: 2024-01-05

TRANSACTION COLUMNS (Stock Plan Supplement):
The document typically shows:
- Symbol (usually INTU for Intuit)
- Qty (number of shares)
- Date Acquired (vest date)
- Date Sold (sale date)
- Proceeds (gross sale proceeds)
- Cost Basis (original cost)
- Adjustment (wash sale adjustment if any)
- Adjusted Cost Basis (use this as costBasis)
- Gain/Loss (capital gain or loss)
- Term (Short/Long)
- Covered status
- Grant Type (RSU)
- Grant Number

IMPORTANT NOTES:
1. Each row represents a separate sale transaction
2. Multiple rows may have the same vest date if shares from the same vest were sold separately
3. Wash sale rows are marked with "WS" or have a non-zero adjustment
4. Gains are positive, losses are shown in parentheses or with minus sign
5. Grant IDs often appear at the end of each row (like B17868)
6. The document may span multiple pages - extract all transactions

CALCULATING PRICES:
- vestPrice = costBasis / shares (FMV at vest)
- salePrice = grossProceeds / shares

Extract every transaction row showing INTU stock sales.`

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
 * Intelligently combines data, preferring Supplement for cost basis details
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

  // If only one type, just return all consolidated
  if (supplementTxs.length === 0) {
    return consolidateTransactions(otherTxs)
  }
  if (otherTxs.length === 0) {
    return consolidateTransactions(supplementTxs)
  }

  // Build lookup from supplement transactions (preferred source for cost basis)
  const supplementByKey = new Map<string, ParsedRsuTransaction[]>()
  for (const tx of supplementTxs) {
    const key = `${tx.vestDate}-${tx.saleDate}`
    if (!supplementByKey.has(key)) {
      supplementByKey.set(key, [])
    }
    supplementByKey.get(key)!.push(tx)
  }

  // Track which supplement transactions have been matched
  const matchedSupplementKeys = new Set<string>()
  const mergedTransactions: ParsedRsuTransaction[] = []

  // For each 1099-B transaction, try to find matching supplement data
  for (const tx of otherTxs) {
    const key = `${tx.vestDate}-${tx.saleDate}`
    const supplementMatches = supplementByKey.get(key)

    if (supplementMatches && supplementMatches.length > 0) {
      // Found matching supplement data - use it (it has better cost basis info)
      matchedSupplementKeys.add(key)
      // Skip the 1099-B transaction, we'll use the supplement data
    } else {
      // No supplement match - use 1099-B data as-is
      mergedTransactions.push(tx)
    }
  }

  // Add all supplement transactions (they have the complete data)
  for (const tx of supplementTxs) {
    mergedTransactions.push(tx)
  }

  // Consolidate to handle any remaining duplicates
  return consolidateTransactions(mergedTransactions)
}
