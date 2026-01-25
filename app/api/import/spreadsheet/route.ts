import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseSpreadsheetCSV, getAccountType } from '@/lib/csv/spreadsheet-parser'
import { CreditCard, CashAccount } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { csvContent } = body

    if (!csvContent) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 })
    }

    // Parse the CSV
    const parsed = parseSpreadsheetCSV(csvContent)

    if (parsed.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing errors',
        details: parsed.errors
      }, { status: 400 })
    }

    if (parsed.months.length === 0) {
      return NextResponse.json({
        error: 'No data found in CSV'
      }, { status: 400 })
    }

    // Get existing credit cards
    const existingCards = db.prepare(`
      SELECT * FROM credit_cards ORDER BY display_order, name
    `).all() as CreditCard[]

    const cardNameToId: Record<string, number> = {}
    for (const card of existingCards) {
      cardNameToId[card.name.toLowerCase()] = card.id
    }

    // Create missing cards
    const missingCards = parsed.cardNames.filter(name =>
      !cardNameToId[name.toLowerCase()]
    )

    for (let i = 0; i < missingCards.length; i++) {
      const cardName = missingCards[i]
      const result = db.prepare(`
        INSERT INTO credit_cards (name, display_order)
        VALUES (?, ?)
      `).run(cardName, existingCards.length + i)

      cardNameToId[cardName.toLowerCase()] = result.lastInsertRowid as number
    }

    // Get existing cash accounts
    const existingAccounts = db.prepare(`
      SELECT * FROM cash_accounts WHERE is_active = 1 ORDER BY display_order, name
    `).all() as CashAccount[]

    // Find default accounts by type
    const defaultAccounts: Record<string, CashAccount | undefined> = {
      checking: existingAccounts.find(a => a.account_type === 'checking' && a.is_default),
      savings: existingAccounts.find(a => a.account_type === 'savings' && a.is_default),
    }

    // Map account names to IDs, using defaults when available
    const accountNameToId: Record<string, number> = {}
    const missingAccounts: string[] = []

    for (const accountName of parsed.accountNames) {
      const accountType = getAccountType(accountName)
      const defaultAccount = defaultAccounts[accountType]

      if (defaultAccount) {
        // Use the default account for this type
        accountNameToId[accountName.toLowerCase()] = defaultAccount.id
      } else {
        // Look for exact match
        const existing = existingAccounts.find(a => a.name.toLowerCase() === accountName.toLowerCase())
        if (existing) {
          accountNameToId[accountName.toLowerCase()] = existing.id
        } else {
          // Need to create this account
          missingAccounts.push(accountName)
        }
      }
    }

    // Create missing accounts (only when no default exists for that type)
    for (let i = 0; i < missingAccounts.length; i++) {
      const accountName = missingAccounts[i]
      const accountType = getAccountType(accountName)
      const result = db.prepare(`
        INSERT INTO cash_accounts (name, account_type, display_order)
        VALUES (?, ?, ?)
      `).run(accountName, accountType, existingAccounts.length + i)

      accountNameToId[accountName.toLowerCase()] = result.lastInsertRowid as number
    }

    // Import the data
    let importedMonths = 0
    let importedCardBalances = 0
    let importedCashBalances = 0

    for (const month of parsed.months) {
      let monthHadData = false

      // Import credit card balances
      for (const cardBalance of month.cardBalances) {
        const cardId = cardNameToId[cardBalance.cardName.toLowerCase()]
        if (!cardId) continue

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

      // Import cash account balances
      for (const accountBalance of month.accountBalances) {
        const accountId = accountNameToId[accountBalance.accountName.toLowerCase()]
        if (!accountId) continue

        const existing = db.prepare(`
          SELECT id FROM monthly_cash_balances
          WHERE cash_account_id = ? AND year = ? AND month = ?
        `).get(accountId, month.year, month.month)

        if (existing) {
          db.prepare(`
            UPDATE monthly_cash_balances
            SET balance = ?, updated_at = datetime('now')
            WHERE cash_account_id = ? AND year = ? AND month = ?
          `).run(accountBalance.balance, accountId, month.year, month.month)
        } else {
          db.prepare(`
            INSERT INTO monthly_cash_balances (cash_account_id, year, month, balance)
            VALUES (?, ?, ?, ?)
          `).run(accountId, month.year, month.month, accountBalance.balance)
        }
        importedCashBalances++
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
        cardsCreated: missingCards.length,
        cashBalances: importedCashBalances,
        accountsCreated: missingAccounts.length
      },
      cardsCreated: missingCards,
      accountsCreated: missingAccounts
    })
  } catch (error) {
    console.error('Failed to import spreadsheet data:', error)
    return NextResponse.json({
      error: 'Failed to import spreadsheet data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
