import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { RsuVesting } from '@/lib/types'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      vest_date,
      shares,
      grant_price,
      grant_date,
      grant_id,
      is_vested,
      actual_price_at_vest,
      sale_date,
      sale_price,
      gross_proceeds,
      taxes_withheld,
      net_proceeds,
      reinvested_amount,
      cash_retained,
    } = body

    const db = getDb()
    const existing = db.prepare('SELECT * FROM rsu_vesting_schedule WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'RSU record not found' }, { status: 404 })
    }

    db.prepare(`
      UPDATE rsu_vesting_schedule
      SET vest_date = ?, shares = ?, grant_price = ?, grant_date = ?, grant_id = ?,
          is_vested = ?, actual_price_at_vest = ?,
          sale_date = ?, sale_price = ?, gross_proceeds = ?, taxes_withheld = ?,
          net_proceeds = ?, reinvested_amount = ?, cash_retained = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      vest_date,
      shares,
      grant_price,
      grant_date,
      grant_id || null,
      is_vested ? 1 : 0,
      actual_price_at_vest || null,
      sale_date || null,
      sale_price || null,
      gross_proceeds || null,
      taxes_withheld || null,
      net_proceeds || null,
      reinvested_amount || null,
      cash_retained || null,
      params.id
    )

    const record = db.prepare('SELECT * FROM rsu_vesting_schedule WHERE id = ?').get(params.id) as RsuVesting

    return NextResponse.json(record)
  } catch (error) {
    console.error('Failed to update RSU record:', error)
    return NextResponse.json({ error: 'Failed to update RSU record' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT * FROM rsu_vesting_schedule WHERE id = ?').get(params.id)

    if (!existing) {
      return NextResponse.json({ error: 'RSU record not found' }, { status: 404 })
    }

    db.prepare('DELETE FROM rsu_vesting_schedule WHERE id = ?').run(params.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete RSU record:', error)
    return NextResponse.json({ error: 'Failed to delete RSU record' }, { status: 500 })
  }
}
