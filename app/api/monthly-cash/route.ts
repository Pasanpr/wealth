import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { CashAccount, MonthlyCashBalance } from '@/lib/types'

interface AccountBalance {
  cash_account_id: number
  account_name: string
  year: number
  month: number
  balance: number
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb()
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')

    // Get all active cash accounts
    const accounts = db.prepare(`
      SELECT * FROM cash_accounts
      WHERE is_active = 1
      ORDER BY display_order, name
    `).all() as CashAccount[]

    // Get balances - either for a specific year or all
    let balances: AccountBalance[]
    if (year) {
      balances = db.prepare(`
        SELECT
          mcb.cash_account_id,
          ca.name as account_name,
          mcb.year,
          mcb.month,
          mcb.balance
        FROM monthly_cash_balances mcb
        JOIN cash_accounts ca ON mcb.cash_account_id = ca.id
        WHERE mcb.year = ?
        ORDER BY mcb.month
      `).all(parseInt(year)) as AccountBalance[]
    } else {
      balances = db.prepare(`
        SELECT
          mcb.cash_account_id,
          ca.name as account_name,
          mcb.year,
          mcb.month,
          mcb.balance
        FROM monthly_cash_balances mcb
        JOIN cash_accounts ca ON mcb.cash_account_id = ca.id
        ORDER BY mcb.year DESC, mcb.month DESC
      `).all() as AccountBalance[]
    }

    // Build monthly data structure (12 months per year)
    const buildMonthlyData = (targetYear: number) => {
      const months = []
      for (let month = 1; month <= 12; month++) {
        const monthBalances = accounts.map(account => {
          const balance = balances.find(
            b => b.cash_account_id === account.id && b.year === targetYear && b.month === month
          )
          return {
            accountId: account.id,
            accountName: account.name,
            balance: balance?.balance ?? 0
          }
        })

        months.push({
          year: targetYear,
          month,
          accountBalances: monthBalances,
          totalCash: monthBalances.reduce((sum, b) => sum + b.balance, 0)
        })
      }
      return months
    }

    if (year) {
      return NextResponse.json({
        year: parseInt(year),
        accounts,
        months: buildMonthlyData(parseInt(year))
      })
    }

    // Return all years with data
    const yearsWithData = [...new Set(balances.map(b => b.year))].sort((a, b) => b - a)

    return NextResponse.json({
      accounts,
      years: yearsWithData.map(y => ({
        year: y,
        months: buildMonthlyData(y)
      }))
    })
  } catch (error) {
    console.error('Failed to fetch monthly cash data:', error)
    return NextResponse.json({ error: 'Failed to fetch monthly cash data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb()
    const body = await request.json()
    const { year, month, accountBalances } = body

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 })
    }

    // Update or insert account balances
    if (accountBalances && Array.isArray(accountBalances)) {
      for (const account of accountBalances) {
        const existing = db.prepare(`
          SELECT id FROM monthly_cash_balances
          WHERE cash_account_id = ? AND year = ? AND month = ?
        `).get(account.accountId, year, month)

        if (existing) {
          db.prepare(`
            UPDATE monthly_cash_balances
            SET balance = ?, updated_at = datetime('now')
            WHERE cash_account_id = ? AND year = ? AND month = ?
          `).run(account.balance, account.accountId, year, month)
        } else {
          db.prepare(`
            INSERT INTO monthly_cash_balances (cash_account_id, year, month, balance)
            VALUES (?, ?, ?, ?)
          `).run(account.accountId, year, month, account.balance)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to save monthly cash data:', error)
    return NextResponse.json({ error: 'Failed to save monthly cash data' }, { status: 500 })
  }
}
