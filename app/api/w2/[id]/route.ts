import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { W2Form, W2Box12Item, W2Box14Item } from '@/lib/types'

interface W2FormRow {
  id: number
  year: number
  employer_name: string
  employer_ein: string | null
  wages_tips_compensation: number
  federal_income_tax_withheld: number
  social_security_wages: number
  social_security_tax_withheld: number
  medicare_wages: number
  medicare_tax_withheld: number
  social_security_tips: number
  allocated_tips: number
  dependent_care_benefits: number
  nonqualified_plans: number
  box_12_items: string
  is_statutory_employee: number
  has_retirement_plan: number
  has_third_party_sick_pay: number
  box_14_items: string
  state_code: string | null
  state_employer_id: string | null
  state_wages: number
  state_income_tax_withheld: number
  local_wages: number
  local_income_tax_withheld: number
  locality_name: string | null
  state_code_2: string | null
  state_employer_id_2: string | null
  state_wages_2: number
  state_income_tax_2: number
  notes: string | null
  created_at: string
  updated_at: string
}

function rowToW2Form(row: W2FormRow): W2Form {
  return {
    ...row,
    box_12_items: JSON.parse(row.box_12_items || '[]') as W2Box12Item[],
    box_14_items: JSON.parse(row.box_14_items || '[]') as W2Box14Item[],
    is_statutory_employee: Boolean(row.is_statutory_employee),
    has_retirement_plan: Boolean(row.has_retirement_plan),
    has_third_party_sick_pay: Boolean(row.has_third_party_sick_pay),
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()

    const row = db
      .prepare('SELECT * FROM w2_forms WHERE id = ?')
      .get(parseInt(id)) as W2FormRow | undefined

    if (!row) {
      return NextResponse.json({ error: 'W-2 not found' }, { status: 404 })
    }

    return NextResponse.json(rowToW2Form(row))
  } catch (error) {
    console.error('Failed to fetch W-2:', error)
    return NextResponse.json({ error: 'Failed to fetch W-2' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const db = getDb()

    const existing = db
      .prepare('SELECT id FROM w2_forms WHERE id = ?')
      .get(parseInt(id))

    if (!existing) {
      return NextResponse.json({ error: 'W-2 not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM w2_forms WHERE id = ?').run(parseInt(id))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete W-2:', error)
    return NextResponse.json({ error: 'Failed to delete W-2' }, { status: 500 })
  }
}
