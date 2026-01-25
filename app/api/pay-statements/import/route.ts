import { NextRequest, NextResponse } from 'next/server'
import { parsePayStatementPdfWithLlm } from '@/lib/services/pdf/pay-statement-parser-llm'
import { validatePayStatement, ValidationResult } from '@/lib/services/pdf/pay-statement-validator'
import {
  checkDuplicate,
  createPayStatement,
} from '@/lib/services/pay-statement'

// Extend timeout for LLM processing (max 5 minutes)
export const maxDuration = 300

// Process files in parallel with concurrency limit to avoid overwhelming the API
const CONCURRENCY_LIMIT = 5

interface ImportResult {
  filename: string
  success: boolean
  statementId?: number
  payDate?: string
  error?: string
  isDuplicate?: boolean
  validation?: ValidationResult
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const previewOnly = formData.get('previewOnly') === 'true'

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const results: ImportResult[] = []
    const parsedStatements: Array<{
      filename: string
      data: Awaited<ReturnType<typeof parsePayStatementPdfWithLlm>>
      rawText?: string
      validation: ValidationResult
    }> = []

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
        const parseResult = await parsePayStatementPdfWithLlm(buffer, false)

        if (!parseResult.success || !parseResult.data) {
          results.push({
            filename: file.name,
            success: false,
            error: parseResult.error ?? 'Failed to parse PDF',
          })
          return
        }

        // Validate the parsed result
        const validation = validatePayStatement(parseResult.data)

        // Check for duplicates (includes gross earnings to allow multiple paychecks on same date)
        const duplicate = checkDuplicate(
          parseResult.fileHash,
          parseResult.data.periodStart,
          parseResult.data.periodEnd,
          parseResult.data.payDate,
          parseResult.data.grossEarnings
        )

        if (duplicate) {
          results.push({
            filename: file.name,
            success: false,
            isDuplicate: true,
            statementId: duplicate.id,
            payDate: duplicate.pay_date,
            error: `Duplicate: statement for ${duplicate.pay_date} already exists`,
            validation,
          })
          return
        }

        parsedStatements.push({
          filename: file.name,
          data: parseResult,
          rawText: parseResult.rawText,
          validation,
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
      console.log(`Processed batch of ${batch.length} files, ${results.length + parsedStatements.length}/${files.length} complete`)
    }

    // If preview only, return parsed data without saving
    if (previewOnly) {
      return NextResponse.json({
        preview: true,
        results,
        statements: parsedStatements.map(p => ({
          filename: p.filename,
          data: p.data.data,
          fileHash: p.data.fileHash,
          rawText: p.rawText,
          validation: p.validation,
        })),
      })
    }

    // Save all valid statements
    for (const parsed of parsedStatements) {
      try {
        const statement = createPayStatement(parsed.data.data!, parsed.data.fileHash)
        results.push({
          filename: parsed.filename,
          success: true,
          statementId: statement.id,
          payDate: statement.pay_date,
          validation: parsed.validation,
        })
      } catch (err) {
        results.push({
          filename: parsed.filename,
          success: false,
          error: err instanceof Error ? err.message : 'Failed to save statement',
          validation: parsed.validation,
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json({
      preview: false,
      successCount,
      failCount,
      results,
    })
  } catch (error) {
    console.error('Failed to import pay statements:', error)
    return NextResponse.json(
      { error: 'Failed to import pay statements' },
      { status: 500 }
    )
  }
}
