import { NextRequest, NextResponse } from 'next/server'
import {
  getPayStatementById,
  updatePayStatement,
  deletePayStatement,
} from '@/lib/services/pay-statement'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const statementId = parseInt(id, 10)

    if (isNaN(statementId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const statement = getPayStatementById(statementId)

    if (!statement) {
      return NextResponse.json(
        { error: 'Pay statement not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(statement)
  } catch (error) {
    console.error('Failed to fetch pay statement:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pay statement' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const statementId = parseInt(id, 10)

    if (isNaN(statementId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const body = await request.json()
    const statement = updatePayStatement(statementId, body)

    if (!statement) {
      return NextResponse.json(
        { error: 'Pay statement not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(statement)
  } catch (error) {
    console.error('Failed to update pay statement:', error)
    return NextResponse.json(
      { error: 'Failed to update pay statement' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const statementId = parseInt(id, 10)

    if (isNaN(statementId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
    }

    const deleted = deletePayStatement(statementId)

    if (!deleted) {
      return NextResponse.json(
        { error: 'Pay statement not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete pay statement:', error)
    return NextResponse.json(
      { error: 'Failed to delete pay statement' },
      { status: 500 }
    )
  }
}
