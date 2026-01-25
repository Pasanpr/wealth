import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { parseCashBalanceCSV, getAccountType } from '@/lib/csv/cash-balance-parser'
import { CashAccount } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { csvContent } = body

    if (!csvContent) {
      return NextResponse.json({ error: 'CSV content is required' }, { status: 400 })
    }

    // Parse the CSV
    const parsed = parseCashBalanceCSV(csvContent)

    if (parsed.errors.length > 0) {
      return NextResponse.json({
        error: 'CSV parsing errors',
        details: parsed.errors
      }, { status: 400 })
    }

    if (parsed.months.length === 0) {
      return NextResponse.json({
        error: 'No cash balance data found in CSV'
      }, { status: 400 })
    }

    // Get existing cash accounts
    const existingAccounts = db.prepare(`
      SELECT * FROM cash_accounts ORDER BY display_order, name
    `).all() as CashAccount[]

    // Create a map of account names to IDs (case insensitive)
    const accountNameToId: Record<string, number> = {}
    for (const account of existingAccounts) {
      accountNameToId[account.name.toLowerCase()] = account.id
    }

    // Track accounts that need to be created
    const missingAccounts = parsed.accountNames.filter(name =>
      !accountNameToId[name.toLowerCase()]
    )

    // Create missing accounts
    for (let i = 0; i < missingAccounts.length; i++) {
      const accountName = missingAccounts[i]
      const accountType = getAccountType(accountName)
      const result = db.prepare(`
        INSERT INTO cash_accounts (name, account_type, display_order)
        VALUES (?, ?, ?)
      `).run(accountName, accountType, existingAccounts.length + i)

      accountNameToId[accountName.toLowerCase()] = result.lastInsertRowid as number
    }

    // Import the cash balances
    let importedMonths = 0
    let importedBalances = 0

    for (const month of parsed.months) {
      let monthHadData = false

      for (const accountBalance of month.accountBalances) {
        const accountId = accountNameToId[accountBalance.accountName.toLowerCase()]
        if (!accountId) {
          console.warn(`Account not found: ${accountBalance.accountName}`)
          continue
        }

        // Skip zero balances
        if (accountBalance.balance === 0) continue

        // Check if record exists
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
        importedBalances++
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
        balances: importedBalances,
        accountsCreated: missingAccounts.length
      },
      accountsCreated: missingAccounts
    })
  } catch (error) {
    console.error('Failed to import cash balance data:', error)
    return NextResponse.json({
      error: 'Failed to import cash balance data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
