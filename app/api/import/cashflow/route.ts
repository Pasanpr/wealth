import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseCashFlowCSV } from '@/lib/csv/cashflow-parser'
import { CreditCard } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { csvContent } = body

    if (!csvContent) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 })
    }

    // Parse the CSV
    const parsed = parseCashFlowCSV(csvContent)

    if (parsed.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing errors',
        details: parsed.errors
      }, { status: 400 })
    }

    if (parsed.months.length === 0) {
      return NextResponse.json({
        error: 'No credit card data found in CSV'
      }, { status: 400 })
    }

    // Get existing credit cards
    const existingCards = db.prepare(`
      SELECT * FROM credit_cards ORDER BY display_order, name
    `).all() as CreditCard[]

    // Create a map of card names to IDs (case insensitive)
    const cardNameToId: Record<string, number> = {}
    for (const card of existingCards) {
      cardNameToId[card.name.toLowerCase()] = card.id
    }

    // Track cards that need to be created
    const missingCards = parsed.cardNames.filter(name =>
      !cardNameToId[name.toLowerCase()]
    )

    // Create missing cards
    for (let i = 0; i < missingCards.length; i++) {
      const cardName = missingCards[i]
      const result = db.prepare(`
        INSERT INTO credit_cards (name, display_order)
        VALUES (?, ?)
      `).run(cardName, existingCards.length + i)

      cardNameToId[cardName.toLowerCase()] = result.lastInsertRowid as number
    }

    // Import the credit card balances
    let importedMonths = 0
    let importedCardBalances = 0

    for (const month of parsed.months) {
      let monthHadData = false

      for (const cardBalance of month.cardBalances) {
        const cardId = cardNameToId[cardBalance.cardName.toLowerCase()]
        if (!cardId) {
          console.warn(`Card not found: ${cardBalance.cardName}`)
          continue
        }

        // Check if record exists
        const existing = db.prepare(`
          SELECT id FROM credit_card_spending
          WHERE credit_card_id = ? AND year = ? AND month = ?
        `).get(cardId, month.year, month.month)

        if (existing) {
          db.prepare(`
            UPDATE credit_card_spending
            SET amount = ?, updated_at = datetime('now')
            WHERE credit_card_id = ? AND year = ? AND month = ?
          `).run(cardBalance.balance, cardId, month.year, month.month)
        } else {
          db.prepare(`
            INSERT INTO credit_card_spending (credit_card_id, year, month, amount)
            VALUES (?, ?, ?, ?)
          `).run(cardId, month.year, month.month, cardBalance.balance)
        }
        importedCardBalances++
        monthHadData = true
      }

      if (monthHadData) {
        importedMonths++
      }
    }

    return NextResponse.json({
      success: true,
      imported: {
        months: importedMonths,
        cardBalances: importedCardBalances,
        cardsCreated: missingCards.length
      },
      cardsCreated: missingCards
    })
  } catch (error) {
    console.error('Failed to import credit card data:', error)
    return NextResponse.json({
      error: 'Failed to import credit card data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
