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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    const db = getDb()

    let query = 'SELECT * FROM w2_forms'
    const params: (string | number)[] = []

    if (year) {
      query += ' WHERE year = ?'
      params.push(parseInt(year))
    }

    query += ' ORDER BY year DESC, employer_name ASC'

    const rows = db.prepare(query).all(...params) as W2FormRow[]
    const forms = rows.map(rowToW2Form)

    return NextResponse.json(forms)
  } catch (error) {
    console.error('Failed to fetch W-2 forms:', error)
    return NextResponse.json({ error: 'Failed to fetch W-2 forms' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      year,
      employer_name,
      employer_ein,
      wages_tips_compensation,
      federal_income_tax_withheld,
      social_security_wages,
      social_security_tax_withheld,
      medicare_wages,
      medicare_tax_withheld,
      social_security_tips,
      allocated_tips,
      dependent_care_benefits,
      nonqualified_plans,
      box_12_items,
      is_statutory_employee,
      has_retirement_plan,
      has_third_party_sick_pay,
      box_14_items,
      state_code,
      state_employer_id,
      state_wages,
      state_income_tax_withheld,
      local_wages,
      local_income_tax_withheld,
      locality_name,
      state_code_2,
      state_employer_id_2,
      state_wages_2,
      state_income_tax_2,
      notes,
    } = body

    if (!year || !employer_name) {
      return NextResponse.json(
        { error: 'Year and employer name are required' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Check if W-2 for this year/employer already exists
    const existing = db
      .prepare('SELECT id FROM w2_forms WHERE year = ? AND employer_name = ?')
      .get(year, employer_name) as { id: number } | undefined

    const box12Json = JSON.stringify(box_12_items || [])
    const box14Json = JSON.stringify(box_14_items || [])

    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE w2_forms SET
          employer_ein = ?,
          wages_tips_compensation = ?,
          federal_income_tax_withheld = ?,
          social_security_wages = ?,
          social_security_tax_withheld = ?,
          medicare_wages = ?,
          medicare_tax_withheld = ?,
          social_security_tips = ?,
          allocated_tips = ?,
          dependent_care_benefits = ?,
          nonqualified_plans = ?,
          box_12_items = ?,
          is_statutory_employee = ?,
          has_retirement_plan = ?,
          has_third_party_sick_pay = ?,
          box_14_items = ?,
          state_code = ?,
          state_employer_id = ?,
          state_wages = ?,
          state_income_tax_withheld = ?,
          local_wages = ?,
          local_income_tax_withheld = ?,
          locality_name = ?,
          state_code_2 = ?,
          state_employer_id_2 = ?,
          state_wages_2 = ?,
          state_income_tax_2 = ?,
          notes = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(
        employer_ein || null,
        wages_tips_compensation || 0,
        federal_income_tax_withheld || 0,
        social_security_wages || 0,
        social_security_tax_withheld || 0,
        medicare_wages || 0,
        medicare_tax_withheld || 0,
        social_security_tips || 0,
        allocated_tips || 0,
        dependent_care_benefits || 0,
        nonqualified_plans || 0,
        box12Json,
        is_statutory_employee ? 1 : 0,
        has_retirement_plan ? 1 : 0,
        has_third_party_sick_pay ? 1 : 0,
        box14Json,
        state_code || null,
        state_employer_id || null,
        state_wages || 0,
        state_income_tax_withheld || 0,
        local_wages || 0,
        local_income_tax_withheld || 0,
        locality_name || null,
        state_code_2 || null,
        state_employer_id_2 || null,
        state_wages_2 || 0,
        state_income_tax_2 || 0,
        notes || null,
        existing.id
      )

      const row = db
        .prepare('SELECT * FROM w2_forms WHERE id = ?')
        .get(existing.id) as W2FormRow
      return NextResponse.json(rowToW2Form(row))
    }

    // Insert new
    const result = db.prepare(`
      INSERT INTO w2_forms (
        year, employer_name, employer_ein,
        wages_tips_compensation, federal_income_tax_withheld,
        social_security_wages, social_security_tax_withheld,
        medicare_wages, medicare_tax_withheld,
        social_security_tips, allocated_tips, dependent_care_benefits, nonqualified_plans,
        box_12_items, is_statutory_employee, has_retirement_plan, has_third_party_sick_pay,
        box_14_items,
        state_code, state_employer_id, state_wages, state_income_tax_withheld,
        local_wages, local_income_tax_withheld, locality_name,
        state_code_2, state_employer_id_2, state_wages_2, state_income_tax_2,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      year,
      employer_name,
      employer_ein || null,
      wages_tips_compensation || 0,
      federal_income_tax_withheld || 0,
      social_security_wages || 0,
      social_security_tax_withheld || 0,
      medicare_wages || 0,
      medicare_tax_withheld || 0,
      social_security_tips || 0,
      allocated_tips || 0,
      dependent_care_benefits || 0,
      nonqualified_plans || 0,
      box12Json,
      is_statutory_employee ? 1 : 0,
      has_retirement_plan ? 1 : 0,
      has_third_party_sick_pay ? 1 : 0,
      box14Json,
      state_code || null,
      state_employer_id || null,
      state_wages || 0,
      state_income_tax_withheld || 0,
      local_wages || 0,
      local_income_tax_withheld || 0,
      locality_name || null,
      state_code_2 || null,
      state_employer_id_2 || null,
      state_wages_2 || 0,
      state_income_tax_2 || 0,
      notes || null
    )

    const row = db
      .prepare('SELECT * FROM w2_forms WHERE id = ?')
      .get(result.lastInsertRowid) as W2FormRow

    return NextResponse.json(rowToW2Form(row), { status: 201 })
  } catch (error) {
    console.error('Failed to save W-2 form:', error)
    return NextResponse.json({ error: 'Failed to save W-2 form' }, { status: 500 })
  }
}
