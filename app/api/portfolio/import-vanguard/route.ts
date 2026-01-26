import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  parseVanguardCSV,
  mapAccountType,
  holdingsToDbRecords,
  transactionsToCashFlows,
  VanguardHolding,
  VanguardTransaction,
} from '@/lib/services/csv/vanguard-parser'

interface AccountType {
  id: number
  code: string
}

interface SecurityRow {
  id: number
  symbol: string
}

interface AccountRow {
  id: number
  name: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const previewOnly = formData.get('previewOnly') === 'true'
    const importHoldings = formData.get('importHoldings') !== 'false'
    const importTransactions = formData.get('importTransactions') !== 'false'
    const holdingsDate = formData.get('holdingsDate') as string || new Date().toISOString().split('T')[0]

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    const csvContent = await file.text()
    const parsed = parseVanguardCSV(csvContent)

    if (previewOnly) {
      return NextResponse.json({
        preview: true,
        holdings: parsed.holdings,
        transactions: parsed.transactions,
        accounts: parsed.accounts,
        summary: parsed.summary,
      })
    }

    // Import to database
    const db = getDb()
    const results = {
      accountsCreated: 0,
      securitiesCreated: 0,
      holdingsImported: 0,
      transactionsImported: 0,
      errors: [] as string[],
    }

    // Get account type mapping
    const accountTypes = db.prepare('SELECT id, code FROM account_types').all() as AccountType[]
    const accountTypeMap = new Map(accountTypes.map(t => [t.code, t.id]))

    // Get or create accounts
    const accountNumberToId = new Map<string, number>()

    for (const account of parsed.accounts) {
      // Check if account exists by name (using account number as name)
      const accountName = `Vanguard ${account.accountNumber}`
      const existing = db.prepare('SELECT id FROM accounts WHERE name = ?').get(accountName) as { id: number } | undefined

      if (existing) {
        accountNumberToId.set(account.accountNumber, existing.id)
      } else {
        // Create new account
        const typeCode = mapAccountType(account.accountType)
        const typeId = accountTypeMap.get(typeCode) || accountTypeMap.get('brokerage')!

        const result = db.prepare(`
          INSERT INTO accounts (name, account_type_id, institution)
          VALUES (?, ?, ?)
        `).run(accountName, typeId, 'Vanguard')

        accountNumberToId.set(account.accountNumber, result.lastInsertRowid as number)
        results.accountsCreated++
      }
    }

    // Get or create securities
    const securitySymbolToId = new Map<string, number>()
    const existingSecurities = db.prepare('SELECT id, symbol FROM securities').all() as SecurityRow[]
    for (const s of existingSecurities) {
      securitySymbolToId.set(s.symbol.toUpperCase(), s.id)
    }

    // Collect unique symbols from holdings
    const uniqueSymbols = new Set(parsed.holdings.map(h => h.symbol.toUpperCase()))

    for (const symbol of uniqueSymbols) {
      if (!securitySymbolToId.has(symbol)) {
        // Find the investment name from holdings
        const holding = parsed.holdings.find(h => h.symbol.toUpperCase() === symbol)
        const name = holding?.investmentName || symbol

        const result = db.prepare(`
          INSERT INTO securities (symbol, name)
          VALUES (?, ?)
        `).run(symbol, name)

        securitySymbolToId.set(symbol, result.lastInsertRowid as number)
        results.securitiesCreated++
      }
    }

    // Import holdings
    if (importHoldings && parsed.holdings.length > 0) {
      const holdingRecords = holdingsToDbRecords(
        parsed.holdings,
        accountNumberToId,
        securitySymbolToId,
        holdingsDate
      )

      const insertHolding = db.prepare(`
        INSERT INTO holdings (account_id, security_id, date, value, shares, cost_basis)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (const record of holdingRecords) {
        try {
          insertHolding.run(
            record.account_id,
            record.security_id,
            record.date,
            record.value,
            record.shares,
            record.cost_basis
          )
          results.holdingsImported++
        } catch (error) {
          results.errors.push(`Failed to import holding: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Import transactions as cash flows
    if (importTransactions && parsed.transactions.length > 0) {
      const cashFlowRecords = transactionsToCashFlows(parsed.transactions, accountNumberToId)

      const insertCashFlow = db.prepare(`
        INSERT INTO cash_flows (account_id, date, amount, flow_type, description)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (const record of cashFlowRecords) {
        try {
          insertCashFlow.run(
            record.account_id,
            record.date,
            record.amount,
            record.flow_type,
            record.description
          )
          results.transactionsImported++
        } catch (error) {
          results.errors.push(`Failed to import transaction: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: parsed.summary,
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to import Vanguard CSV:', error)
    return NextResponse.json(
      { error: 'Failed to import CSV', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
