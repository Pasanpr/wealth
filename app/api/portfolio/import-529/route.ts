import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import {
  parseVanguard529Pdf,
  convert529ToHoldings,
  convert529ToCashFlow,
  Vanguard529Account,
  Vanguard529Contribution,
} from '@/lib/services/pdf/vanguard-529-parser'

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
    const importContributions = formData.get('importContributions') !== 'false'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parseResult = await parseVanguard529Pdf(buffer, false)

    if (!parseResult.success || !parseResult.data) {
      return NextResponse.json(
        { error: parseResult.error || 'Failed to parse PDF' },
        { status: 400 }
      )
    }

    const parsed = parseResult.data

    if (previewOnly) {
      return NextResponse.json({
        preview: true,
        statementDate: parsed.statementDate,
        totalValue: parsed.totalValue,
        accounts: parsed.accounts,
        contributions: parsed.contributions,
        summary: {
          accountCount: parsed.accounts.length,
          totalValue: parsed.totalValue,
          contributionCount: parsed.contributions.length,
          totalContributions: parsed.contributions.reduce((sum, c) => sum + c.amount, 0),
        },
      })
    }

    // Import to database
    const db = getDb()
    const results = {
      accountsCreated: 0,
      securitiesCreated: 0,
      holdingsImported: 0,
      contributionsImported: 0,
      errors: [] as string[],
    }

    // Get 529 account type
    const accountTypes = db.prepare('SELECT id, code FROM account_types').all() as AccountType[]
    const accountTypeId = accountTypes.find(t => t.code === '529')?.id

    if (!accountTypeId) {
      return NextResponse.json(
        { error: '529 account type not found in database' },
        { status: 500 }
      )
    }

    // Map beneficiary names to account IDs
    const beneficiaryToAccountId = new Map<string, number>()

    for (const account of parsed.accounts) {
      // Create account name from beneficiary (e.g., "529 - Milan")
      const firstName = account.beneficiaryName.split(' ')[0]
      const accountName = `529 - ${firstName}`

      // Check if account exists
      const existing = db.prepare('SELECT id FROM accounts WHERE name = ?').get(accountName) as { id: number } | undefined

      if (existing) {
        beneficiaryToAccountId.set(account.beneficiaryName, existing.id)
      } else {
        // Create new account
        const result = db.prepare(`
          INSERT INTO accounts (name, account_type_id, institution, beneficiary)
          VALUES (?, ?, ?, ?)
        `).run(accountName, accountTypeId, 'Vanguard', account.beneficiaryName)

        beneficiaryToAccountId.set(account.beneficiaryName, result.lastInsertRowid as number)
        results.accountsCreated++
      }
    }

    // Get or create securities for 529 portfolios
    const portfolioToSecurityId = new Map<string, number>()
    const existingSecurities = db.prepare('SELECT id, symbol FROM securities').all() as SecurityRow[]
    for (const s of existingSecurities) {
      portfolioToSecurityId.set(s.symbol.toUpperCase(), s.id)
    }

    for (const account of parsed.accounts) {
      const symbol = account.portfolioName.replace(/\s+/g, '').toUpperCase() // e.g., "TRGT32/33"

      if (!portfolioToSecurityId.has(symbol)) {
        // Create security with descriptive name
        const name = `Vanguard 529 Target ${account.portfolioName.replace('TRGT ', '20')}`

        const result = db.prepare(`
          INSERT INTO securities (symbol, name, description)
          VALUES (?, ?, ?)
        `).run(symbol, name, 'Vanguard 529 College Savings Plan Target Date Portfolio')

        portfolioToSecurityId.set(symbol, result.lastInsertRowid as number)
        results.securitiesCreated++
      }
    }

    // Import holdings
    if (importHoldings) {
      const insertHolding = db.prepare(`
        INSERT INTO holdings (account_id, security_id, date, value, shares, cost_basis)
        VALUES (?, ?, ?, ?, ?, ?)
      `)

      for (const account of parsed.accounts) {
        const accountId = beneficiaryToAccountId.get(account.beneficiaryName)
        const symbol = account.portfolioName.replace(/\s+/g, '').toUpperCase()
        const securityId = portfolioToSecurityId.get(symbol)

        if (accountId && securityId) {
          try {
            const holding = convert529ToHoldings(
              account,
              parsed.statementDate,
              accountId,
              securityId
            )

            insertHolding.run(
              holding.account_id,
              holding.security_id,
              holding.date,
              holding.value,
              holding.shares,
              holding.cost_basis
            )
            results.holdingsImported++
          } catch (error) {
            results.errors.push(
              `Failed to import holding for ${account.beneficiaryName}: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          }
        }
      }
    }

    // Import contributions as cash flows
    if (importContributions) {
      const insertCashFlow = db.prepare(`
        INSERT INTO cash_flows (account_id, date, amount, flow_type, description)
        VALUES (?, ?, ?, ?, ?)
      `)

      for (const contribution of parsed.contributions) {
        // Find the account by matching portfolio name
        const account = parsed.accounts.find(
          a => a.portfolioName.toLowerCase() === contribution.portfolioName.toLowerCase()
        )

        if (!account) continue

        const accountId = beneficiaryToAccountId.get(account.beneficiaryName)

        if (accountId) {
          try {
            const cashFlow = convert529ToCashFlow(contribution, accountId)

            insertCashFlow.run(
              cashFlow.account_id,
              cashFlow.date,
              cashFlow.amount,
              cashFlow.flow_type,
              cashFlow.description
            )
            results.contributionsImported++
          } catch (error) {
            results.errors.push(
              `Failed to import contribution on ${contribution.tradeDate}: ${error instanceof Error ? error.message : 'Unknown error'}`
            )
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        statementDate: parsed.statementDate,
        accountCount: parsed.accounts.length,
        totalValue: parsed.totalValue,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to import 529 statement:', error)
    return NextResponse.json(
      { error: 'Failed to import PDF', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
