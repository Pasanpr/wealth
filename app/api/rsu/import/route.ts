import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { RsuVesting } from '@/lib/types'
import {
  parseRsuDocumentWithLlm,
  consolidateTransactions,
  ParsedRsuTransaction,
  ParsedRsuDocument,
} from '@/lib/services/pdf/rsu-parser-llm'

// Extend timeout for LLM processing (max 5 minutes)
export const maxDuration = 300

// Process files in parallel with concurrency limit
const CONCURRENCY_LIMIT = 3

interface ImportResult {
  filename: string
  success: boolean
  recordCount?: number
  error?: string
  isDuplicate?: boolean
}

interface ParsedFile {
  filename: string
  data: ParsedRsuDocument
  fileHash: string
  rawText?: string
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''

    // Handle FormData (file uploads)
    if (contentType.includes('multipart/form-data')) {
      return handleFileUpload(request)
    }

    // Handle JSON (legacy support for manual/programmatic imports)
    return handleJsonImport(request)
  } catch (error) {
    console.error('Failed to import RSU records:', error)
    return NextResponse.json({ error: 'Failed to import RSU records' }, { status: 500 })
  }
}

async function handleFileUpload(request: NextRequest) {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const previewOnly = formData.get('previewOnly') === 'true'
  const consolidate = formData.get('consolidate') !== 'false' // Default to true

  if (!files || files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  const results: ImportResult[] = []
  const parsedFiles: ParsedFile[] = []

  // Helper to process a single file
  async function processFile(file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      results.push({
        filename: file.name,
        success: false,
        error: 'File must be a PDF',
      })
      return
    }

    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const parseResult = await parseRsuDocumentWithLlm(buffer, false)

      if (!parseResult.success || !parseResult.data) {
        results.push({
          filename: file.name,
          success: false,
          error: parseResult.error ?? 'Failed to parse PDF',
        })
        return
      }

      if (parseResult.data.transactions.length === 0) {
        results.push({
          filename: file.name,
          success: false,
          error: 'No RSU transactions found in document',
        })
        return
      }

      parsedFiles.push({
        filename: file.name,
        data: parseResult.data,
        fileHash: parseResult.fileHash,
        rawText: parseResult.rawText,
      })
    } catch (err) {
      results.push({
        filename: file.name,
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // Process files in parallel with concurrency limit
  const batches: File[][] = []
  for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
    batches.push(files.slice(i, i + CONCURRENCY_LIMIT))
  }

  for (const batch of batches) {
    await Promise.all(batch.map(processFile))
    console.log(`Processed batch of ${batch.length} files`)
  }

  // Consolidate transactions if requested
  const allTransactions: Array<ParsedRsuTransaction & { filename: string }> = []
  for (const parsed of parsedFiles) {
    for (const tx of parsed.data.transactions) {
      allTransactions.push({ ...tx, filename: parsed.filename })
    }
  }

  const consolidatedTransactions = consolidate
    ? consolidateTransactions(allTransactions)
    : allTransactions

  // If preview only, return parsed data without saving
  if (previewOnly) {
    return NextResponse.json({
      preview: true,
      results,
      files: parsedFiles.map(p => ({
        filename: p.filename,
        documentType: p.data.documentType,
        taxYear: p.data.taxYear,
        transactionCount: p.data.transactions.length,
        totals: p.data.totals,
        rawText: p.rawText, // Include raw LLM output for debugging
      })),
      transactions: consolidatedTransactions,
      totals: {
        totalShares: consolidatedTransactions.reduce((s, t) => s + t.shares, 0),
        totalProceeds: consolidatedTransactions.reduce((s, t) => s + t.grossProceeds, 0),
        totalCostBasis: consolidatedTransactions.reduce((s, t) => s + t.costBasis, 0),
        totalGainLoss: consolidatedTransactions.reduce((s, t) => s + t.capitalGainLoss, 0),
      },
    })
  }

  // Save all transactions
  const db = getDb()
  const insertStmt = db.prepare(`
    INSERT INTO rsu_vesting_schedule (
      vest_date, shares, grant_price, grant_date, grant_id, is_vested, actual_price_at_vest,
      sale_date, sale_price, gross_proceeds, taxes_withheld, net_proceeds, reinvested_amount, cash_retained
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction((transactions: ParsedRsuTransaction[]) => {
    const inserted: RsuVesting[] = []

    for (const tx of transactions) {
      const result = insertStmt.run(
        tx.vestDate,
        tx.shares,
        tx.vestPrice, // grant_price = vest price (FMV)
        tx.vestDate, // grant_date = vest date for immediate sell
        tx.grantId,
        tx.vestPrice, // actual_price_at_vest
        tx.saleDate,
        tx.salePrice,
        tx.grossProceeds,
        null, // taxes_withheld - can be filled in later from W-2
        null, // net_proceeds
        null, // reinvested_amount
        null // cash_retained
      )

      const insertedRecord = db
        .prepare('SELECT * FROM rsu_vesting_schedule WHERE id = ?')
        .get(result.lastInsertRowid) as RsuVesting
      inserted.push(insertedRecord)
    }

    return inserted
  })

  try {
    const insertedRecords = insertMany(consolidatedTransactions)

    for (const parsed of parsedFiles) {
      results.push({
        filename: parsed.filename,
        success: true,
        recordCount: parsed.data.transactions.length,
      })
    }

    return NextResponse.json({
      preview: false,
      successCount: insertedRecords.length,
      failCount: results.filter(r => !r.success).length,
      results,
      records: insertedRecords,
    }, { status: 201 })
  } catch (err) {
    console.error('Failed to save RSU records:', err)
    return NextResponse.json({ error: 'Failed to save RSU records' }, { status: 500 })
  }
}

// Legacy JSON import for programmatic use
async function handleJsonImport(request: NextRequest) {
  const body = await request.json()
  const { records, grantDate, grantPrice } = body as {
    records: Array<{
      vestDate: string
      saleDate: string
      shares: number
      vestPrice: number
      salePrice: number
      grossProceeds: number
      costBasis: number
      taxesWithheld?: number
      netProceeds?: number
      grantId?: string
      reinvestedAmount?: number
      cashRetained?: number
    }>
    grantDate?: string
    grantPrice?: number
  }

  if (!records || !Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'No records provided' }, { status: 400 })
  }

  const db = getDb()
  const insertStmt = db.prepare(`
    INSERT INTO rsu_vesting_schedule (
      vest_date, shares, grant_price, grant_date, grant_id, is_vested, actual_price_at_vest,
      sale_date, sale_price, gross_proceeds, taxes_withheld, net_proceeds, reinvested_amount, cash_retained
    )
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertMany = db.transaction((records: typeof body.records) => {
    const inserted: RsuVesting[] = []

    for (const record of records) {
      const effectiveGrantDate = grantDate || record.vestDate
      const effectiveGrantPrice = grantPrice || record.vestPrice

      const result = insertStmt.run(
        record.vestDate,
        record.shares,
        effectiveGrantPrice,
        effectiveGrantDate,
        record.grantId || null,
        record.vestPrice,
        record.saleDate || null,
        record.salePrice || null,
        record.grossProceeds || null,
        record.taxesWithheld || null,
        record.netProceeds || null,
        record.reinvestedAmount || null,
        record.cashRetained || null
      )

      const insertedRecord = db
        .prepare('SELECT * FROM rsu_vesting_schedule WHERE id = ?')
        .get(result.lastInsertRowid) as RsuVesting
      inserted.push(insertedRecord)
    }

    return inserted
  })

  const insertedRecords = insertMany(records)

  return NextResponse.json(
    {
      success: true,
      count: insertedRecords.length,
      records: insertedRecords,
    },
    { status: 201 }
  )
}
