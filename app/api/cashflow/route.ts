import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { MonthlyCashFlow, CreditCard, FixedExpense } from '@/lib/types'

interface CardBalance {
  credit_card_id: number
  card_name: string
  year: number
  month: number
  amount: number
}

interface Snapshot {
  year: number
  month: number
  checking_balance: number
  transfers: number
  checking_desired_end: number
  checking_payment: number
  savings_payment: number
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    if (!year) {
      return NextResponse.json({ error: 'Year is required' }, { status: 400 })
    }

    const yearNum = parseInt(year)

    // Get all credit cards (for consistent columns)
    const cards = db.prepare(`
      SELECT * FROM credit_cards
      WHERE is_active = 1
      ORDER BY display_order, name
    `).all() as CreditCard[]

    // Get all card balances for the year
    const cardBalances = db.prepare(`
      SELECT
        ccs.credit_card_id,
        cc.name as card_name,
        ccs.year,
        ccs.month,
        ccs.amount
      FROM credit_card_spending ccs
      JOIN credit_cards cc ON ccs.credit_card_id = cc.id
      WHERE ccs.year = ?
      ORDER BY ccs.month
    `).all(yearNum) as CardBalance[]

    // Get monthly snapshots for the year
    const snapshots = db.prepare(`
      SELECT year, month, checking_balance, transfers, checking_desired_end, checking_payment, savings_payment
      FROM monthly_snapshots
      WHERE year = ?
      ORDER BY month
    `).all(yearNum) as Snapshot[]

    // Get active fixed expenses
    const fixedExpenses = db.prepare(`
      SELECT * FROM fixed_expenses
      WHERE is_active = 1
      ORDER BY display_order, name
    `).all() as FixedExpense[]

    const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0)

    // Build monthly cash flow data for each month
    const months: MonthlyCashFlow[] = []

    for (let month = 1; month <= 12; month++) {
      const snapshot = snapshots.find(s => s.month === month)
      const monthBalances = cardBalances.filter(b => b.month === month)

      // Build card balances array with all cards (even if no data)
      const cardBalancesForMonth = cards.map(card => {
        const balance = monthBalances.find(b => b.credit_card_id === card.id)
        return {
          cardId: card.id,
          cardName: card.name,
          balance: balance?.amount ?? 0
        }
      })

      const totalCredit = cardBalancesForMonth.reduce((sum, c) => sum + c.balance, 0)
      const checkingBalance = snapshot?.checking_balance ?? 0
      const transfers = snapshot?.transfers ?? 0
      const checkingDesiredEnd = snapshot?.checking_desired_end ?? 0

      // Available checking = checking - transfers - fixed expenses - desired end
      const availableChecking = checkingBalance - transfers - totalFixedExpenses - checkingDesiredEnd

      months.push({
        year: yearNum,
        month,
        cardBalances: cardBalancesForMonth,
        totalCredit,
        checkingBalance,
        transfers,
        fixedExpenses: fixedExpenses.map(e => ({ name: e.name, amount: e.amount })),
        totalFixedExpenses,
        checkingDesiredEnd,
        availableChecking,
        checkingPayment: snapshot?.checking_payment ?? 0,
        savingsPayment: snapshot?.savings_payment ?? 0
      })
    }

    return NextResponse.json({
      year: yearNum,
      cards,
      fixedExpenses,
      months
    })
  } catch (error) {
    console.error('Failed to fetch cash flow data:', error)
    return NextResponse.json({ error: 'Failed to fetch cash flow data' }, { status: 500 })
  }
}

// Save/update a full month's data
export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { year, month, cardBalances, checkingBalance, transfers, checkingDesiredEnd, checkingPayment, savingsPayment } = body

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 })
    }

    // Update or insert card balances
    if (cardBalances && Array.isArray(cardBalances)) {
      for (const card of cardBalances) {
        const existing = db.prepare(`
          SELECT id FROM credit_card_spending
          WHERE credit_card_id = ? AND year = ? AND month = ?
        `).get(card.cardId, year, month)

        if (existing) {
          db.prepare(`
            UPDATE credit_card_spending
            SET amount = ?, updated_at = datetime('now')
            WHERE credit_card_id = ? AND year = ? AND month = ?
          `).run(card.balance, card.cardId, year, month)
        } else {
          db.prepare(`
            INSERT INTO credit_card_spending (credit_card_id, year, month, amount)
            VALUES (?, ?, ?, ?)
          `).run(card.cardId, year, month, card.balance)
        }
      }
    }

    // Update or insert monthly snapshot
    const existingSnapshot = db.prepare(`
      SELECT id FROM monthly_snapshots WHERE year = ? AND month = ?
    `).get(year, month)

    if (existingSnapshot) {
      db.prepare(`
        UPDATE monthly_snapshots
        SET checking_balance = ?, transfers = ?, checking_desired_end = ?,
            checking_payment = ?, savings_payment = ?, updated_at = datetime('now')
        WHERE year = ? AND month = ?
      `).run(
        checkingBalance ?? 0,
        transfers ?? 0,
        checkingDesiredEnd ?? 0,
        checkingPayment ?? 0,
        savingsPayment ?? 0,
        year,
        month
      )
    } else {
      db.prepare(`
        INSERT INTO monthly_snapshots (year, month, checking_balance, transfers, checking_desired_end, checking_payment, savings_payment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        year,
        month,
        checkingBalance ?? 0,
        transfers ?? 0,
        checkingDesiredEnd ?? 0,
        checkingPayment ?? 0,
        savingsPayment ?? 0
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save cash flow data:', error)
    return NextResponse.json({ error: 'Failed to save cash flow data' }, { status: 500 })
  }
}
