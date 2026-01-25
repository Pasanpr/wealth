import { NextRequest, NextResponse } from 'next/server'
import {
  getPayStatements,
  createPayStatement,
  getPayStatementYears,
  checkDuplicate,
} from '@/lib/services/pay-statement'
import { ParsedPayStatement } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const yearParam = searchParams.get('year')
    const year = yearParam ? parseInt(yearParam, 10) : undefined

    const statements = getPayStatements(year)
    const years = getPayStatementYears()

    return NextResponse.json({ statements, years })
  } catch (error) {
    console.error('Failed to fetch pay statements:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay statements' },
      { status: 500 }
    )
  }
}

interface CreatePayStatementBody extends ParsedPayStatement {
  fileHash?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreatePayStatementBody

    if (!body.periodStart || !body.periodEnd || !body.payDate) {
      return NextResponse.json(
        { error: 'Missing required fields: periodStart, periodEnd, payDate' },
        { status: 400 }
      )
    }

    // Check for duplicates before creating
    const existing = checkDuplicate(
      body.fileHash,
      body.periodStart,
      body.periodEnd,
      body.payDate
    )

    if (existing) {
      return NextResponse.json(
        {
          error: `Duplicate: statement for ${existing.pay_date} already exists`,
          isDuplicate: true,
          existingId: existing.id,
        },
        { status: 409 }
      )
    }

    const statement = createPayStatement(body, body.fileHash)
    return NextResponse.json(statement, { status: 201 })
  } catch (error) {
    console.error('Failed to create pay statement:', error)
    return NextResponse.json(
      { error: 'Failed to create pay statement' },
      { status: 500 }
    )
  }
}
