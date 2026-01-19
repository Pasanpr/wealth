import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  parseIncomeCSV,
  parseSpendingCSV,
  parseHoldingsCSV,
  parseSecuritiesCSV,
  parseCashFlowsCSV,
  parseTaxProfileCSV,
} from '@/lib/csv/parser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const importType = formData.get('type') as string

    if (!file || !importType) {
      return NextResponse.json({ error: 'File and type are required' }, { status: 400 })
    }

    const content = await file.text()
    const db = getDb()

    let imported = 0
    let errors: string[] = []

    switch (importType) {
      case 'income': {
        const result = parseIncomeCSV(content)
        errors = result.errors

        if (result.data.length > 0) {
          const stmt = db.prepare(`
            INSERT INTO income_records (income_type, amount, date, description, is_recurring)
            VALUES (?, ?, ?, ?, ?)
          `)

          for (const row of result.data) {
            stmt.run(row.income_type, row.amount, row.date, row.description, row.is_recurring ? 1 : 0)
            imported++
          }
        }
        break
      }

      case 'spending': {
        const result = parseSpendingCSV(content)
        errors = result.errors

        if (result.data.length > 0) {
          // Get card name to ID mapping
          const cards = db.prepare('SELECT id, name FROM credit_cards').all() as { id: number; name: string }[]
          const cardMap = new Map(cards.map(c => [c.name.toLowerCase(), c.id]))

          const stmt = db.prepare(`
            INSERT OR REPLACE INTO credit_card_spending (credit_card_id, year, month, amount)
            VALUES (?, ?, ?, ?)
          `)

          for (const row of result.data) {
            const cardId = cardMap.get(row.card_name.toLowerCase())
            if (!cardId) {
              errors.push(`Card not found: ${row.card_name}`)
              continue
            }
            stmt.run(cardId, row.year, row.month, row.amount)
            imported++
          }
        }
        break
      }

      case 'holdings': {
        const result = parseHoldingsCSV(content)
        errors = result.errors

        if (result.data.length > 0) {
          // Get account name to ID mapping
          const accounts = db.prepare('SELECT id, name FROM accounts').all() as { id: number; name: string }[]
          const accountMap = new Map(accounts.map(a => [a.name.toLowerCase(), a.id]))

          // Get security symbol to ID mapping
          const securities = db.prepare('SELECT id, symbol FROM securities').all() as { id: number; symbol: string }[]
          const securityMap = new Map(securities.map(s => [s.symbol.toLowerCase(), s.id]))

          const stmt = db.prepare(`
            INSERT INTO holdings (account_id, security_id, date, value, shares, cost_basis)
            VALUES (?, ?, ?, ?, ?, ?)
          `)

          for (const row of result.data) {
            const accountId = accountMap.get(row.account_name.toLowerCase())
            if (!accountId) {
              errors.push(`Account not found: ${row.account_name}`)
              continue
            }

            const securityId = securityMap.get(row.symbol.toLowerCase())
            if (!securityId) {
              errors.push(`Security not found: ${row.symbol}`)
              continue
            }

            stmt.run(accountId, securityId, row.date, row.value, row.shares, row.cost_basis)
            imported++
          }
        }
        break
      }

      case 'securities': {
        const result = parseSecuritiesCSV(content)
        errors = result.errors

        if (result.data.length > 0) {
          // Get asset class name to ID mapping
          const classes = db.prepare('SELECT id, name FROM asset_classes').all() as { id: number; name: string }[]
          const classMap = new Map(classes.map(c => [c.name.toLowerCase(), c.id]))

          const stmt = db.prepare(`
            INSERT OR IGNORE INTO securities (symbol, name, asset_class_id)
            VALUES (?, ?, ?)
          `)

          for (const row of result.data) {
            const assetClassId = row.asset_class ? classMap.get(row.asset_class.toLowerCase()) : null
            stmt.run(row.symbol, row.name, assetClassId || null)
            imported++
          }
        }
        break
      }

      case 'cash_flows': {
        const result = parseCashFlowsCSV(content)
        errors = result.errors

        if (result.data.length > 0) {
          const accounts = db.prepare('SELECT id, name FROM accounts').all() as { id: number; name: string }[]
          const accountMap = new Map(accounts.map(a => [a.name.toLowerCase(), a.id]))

          const stmt = db.prepare(`
            INSERT INTO cash_flows (account_id, date, amount, flow_type, description)
            VALUES (?, ?, ?, ?, ?)
          `)

          for (const row of result.data) {
            const accountId = accountMap.get(row.account_name.toLowerCase())
            if (!accountId) {
              errors.push(`Account not found: ${row.account_name}`)
              continue
            }

            stmt.run(accountId, row.date, row.amount, row.flow_type, row.description)
            imported++
          }
        }
        break
      }

      case 'tax_profile': {
        const result = parseTaxProfileCSV(content)
        errors = result.errors

        if (result.data.length > 0) {
          const stmt = db.prepare(`
            INSERT OR IGNORE INTO tax_profile (year, gross_income, federal_tax, state_tax)
            VALUES (?, ?, ?, ?)
          `)

          for (const row of result.data) {
            stmt.run(row.year, row.gross_income, row.federal_tax, row.state_tax)
            imported++
          }
        }
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid import type' }, { status: 400 })
    }

    return NextResponse.json({ imported, errors })
  } catch (error) {
    console.error('Import failed:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
