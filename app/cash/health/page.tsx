'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { CashAccount } from '@/lib/types'
import { AlertCircle, CheckCircle, AlertTriangle, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface CashHealthData {
  health: {
    totalCash: number
    monthlyExpenseAverage: number
    monthsCovered: number
    targetMonths: number
    status: 'healthy' | 'warning' | 'critical'
  }
  coverage: { months: number; amount: number; coverage: number }[]
}

interface AccountWithLatestBalance {
  account: CashAccount
  latestBalance: number
  latestPeriod: { year: number; month: number } | null
}

export default function CashHealthPage() {
  const [healthData, setHealthData] = useState<CashHealthData | null>(null)
  const [accountBalances, setAccountBalances] = useState<AccountWithLatestBalance[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [healthRes, cashRes] = await Promise.all([
        fetch('/api/cash-health'),
        fetch('/api/monthly-cash'),
      ])
      const health = await healthRes.json()
      const cashData = await cashRes.json()

      setHealthData(health)

      // Extract latest balance for each account
      if (cashData.accounts && cashData.years) {
        const latestBalances: AccountWithLatestBalance[] = cashData.accounts.map((account: CashAccount) => {
          // Find the latest balance for this account across all years
          let latestBalance = 0
          let latestPeriod: { year: number; month: number } | null = null

          for (const yearData of cashData.years) {
            for (const monthData of yearData.months) {
              const accountBalance = monthData.accountBalances.find(
                (b: { accountId: number; balance: number }) => b.accountId === account.id
              )
              if (accountBalance && accountBalance.balance > 0) {
                if (!latestPeriod || yearData.year > latestPeriod.year ||
                    (yearData.year === latestPeriod.year && monthData.month > latestPeriod.month)) {
                  latestBalance = accountBalance.balance
                  latestPeriod = { year: yearData.year, month: monthData.month }
                }
              }
            }
          }

          return { account, latestBalance, latestPeriod }
        })

        setAccountBalances(latestBalances.filter((ab: AccountWithLatestBalance) => ab.latestBalance > 0))
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const formatPeriod = (period: { year: number; month: number } | null) => {
    if (!period) return '--'
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[period.month - 1]} ${period.year}`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-8 w-8 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-8 w-8 text-yellow-600" />
      case 'critical':
        return <AlertCircle className="h-8 w-8 text-red-600" />
      default:
        return null
    }
  }

  const getStatusMessage = (status: string, monthsCovered: number, targetMonths: number) => {
    switch (status) {
      case 'healthy':
        return `You have ${formatNumber(monthsCovered, 1)} months of expenses covered, exceeding your ${targetMonths} month target.`
      case 'warning':
        return `You have ${formatNumber(monthsCovered, 1)} months of expenses covered, below your ${targetMonths} month target.`
      case 'critical':
        return `You only have ${formatNumber(monthsCovered, 1)} months of expenses covered. Consider building your cash reserves.`
      default:
        return ''
    }
  }

  return (
    <PageContainer
      title="Cash Health Analysis"
      description="Monitor your cash reserves and expense coverage"
      actions={
        <Link href="/cash/balances">
          <Button variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            Manage Balances
          </Button>
        </Link>
      }
    >
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Status Card */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {healthData && getStatusIcon(healthData.health.status)}
                <div>
                  <h3 className="text-xl font-semibold capitalize mb-1">
                    {healthData?.health.status || 'Unknown'} Status
                  </h3>
                  <p className="text-muted-foreground">
                    {healthData && getStatusMessage(
                      healthData.health.status,
                      healthData.health.monthsCovered,
                      healthData.health.targetMonths
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Cash</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData ? formatCurrency(healthData.health.totalCash) : '--'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData ? formatCurrency(healthData.health.monthlyExpenseAverage) : '--'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Months Covered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData ? formatNumber(healthData.health.monthsCovered, 1) : '--'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coverage Bars */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Expense Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              {healthData?.coverage && healthData.coverage.length > 0 ? (
                <div className="space-y-6">
                  {healthData.coverage.map(item => (
                    <div key={item.months}>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">
                          {item.months} Month{item.months > 1 ? 's' : ''}
                        </span>
                        <span className={item.coverage >= 1 ? 'text-green-600' : 'text-yellow-600'}>
                          {item.coverage >= 1
                            ? `Covered (${formatNumber(item.coverage * 100, 0)}%)`
                            : `${formatNumber(item.coverage * 100, 0)}% covered`}
                        </span>
                      </div>
                      <div className="h-4 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            item.coverage >= 1 ? 'bg-green-600' : 'bg-yellow-600'
                          }`}
                          style={{ width: `${Math.min(item.coverage * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Required: {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Add cash balances and yearly expenses to see coverage analysis.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Account Balances */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {accountBalances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cash balances recorded yet.{' '}
                  <Link href="/cash/balances" className="text-primary hover:underline">
                    Add balances in Cash Balances
                  </Link>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountBalances.map(({ account, latestBalance, latestPeriod }) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(latestBalance)}</TableCell>
                        <TableCell>{formatPeriod(latestPeriod)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(accountBalances.reduce((sum, a) => sum + a.latestBalance, 0))}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  )
}
