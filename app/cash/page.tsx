'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  LearnMore,
  TermTooltip,
} from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Calendar,
  ArrowUpDown,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { useDisplayMode } from '@/lib/context/display-mode'
import { CashAccount } from '@/lib/types'

interface IncomeData {
  averageNetPay: number
  expectedMonthlyIncome: number
  payFrequency: 'biweekly' | 'semimonthly' | 'monthly' | 'unknown'
  paychecksPerMonth: number
  incomeVsExpenses: number
  ytdSalaryIncome: number
  ytdTotalIncome: number
  lastPayDate: string | null
  paycheckCount: number
}

interface CashHealthData {
  health: {
    totalCash: number
    monthlyExpenseAverage: number
    monthsCovered: number
    targetMonths: number
    status: 'healthy' | 'warning' | 'critical'
  }
  coverage: { months: number; amount: number; coverage: number }[]
  income?: IncomeData
}

interface AccountWithLatestBalance {
  account: CashAccount
  latestBalance: number
  latestPeriod: { year: number; month: number } | null
}

const PAY_FREQUENCY_LABELS: Record<string, string> = {
  biweekly: 'Bi-weekly (every 2 weeks)',
  semimonthly: 'Semi-monthly (2x/month)',
  monthly: 'Monthly',
  unknown: 'Unknown',
}

export default function CashDashboard() {
  const [data, setData] = useState<CashHealthData | null>(null)
  const [accountBalances, setAccountBalances] = useState<AccountWithLatestBalance[]>([])
  const [loading, setLoading] = useState(true)
  const { isAdvanced } = useDisplayMode()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [healthRes, cashRes] = await Promise.all([
          fetch('/api/cash-health'),
          fetch('/api/monthly-cash'),
        ])
        const health = await healthRes.json()
        const cashData = await cashRes.json()

        setData(health)

        // Extract latest balance for each account
        if (cashData.accounts && cashData.years) {
          const latestBalances: AccountWithLatestBalance[] = cashData.accounts.map((account: CashAccount) => {
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

    fetchData()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-muted-foreground'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-6 w-6 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-6 w-6 text-yellow-600" />
      case 'critical':
        return <AlertCircle className="h-6 w-6 text-red-600" />
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

  const formatPeriod = (period: { year: number; month: number } | null) => {
    if (!period) return '--'
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[period.month - 1]} ${period.year}`
  }

  return (
    <PageContainer
      title="Cash & Income"
      description="Track your cash reserves, income, and expenses"
    >
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Status Banner */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {data && getStatusIcon(data.health.status)}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold capitalize mb-1">
                    {data?.health.status || 'Unknown'} Status
                  </h3>
                  <p className="text-muted-foreground">
                    {data && getStatusMessage(
                      data.health.status,
                      data.health.monthsCovered,
                      data.health.targetMonths
                    )}
                  </p>
                </div>
                <Link
                  href="/cash/balances"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Manage Accounts
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cash</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.health.totalCash ? formatCurrency(data.health.totalCash) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">Across all accounts</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.health.monthlyExpenseAverage ? formatCurrency(data.health.monthlyExpenseAverage) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">Average per month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Months Covered</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.health.monthsCovered ? formatNumber(data.health.monthsCovered, 1) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Target: {data?.health.targetMonths || 6} months
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
                <AlertCircle className={`h-4 w-4 ${getStatusColor(data?.health.status || '')}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold capitalize ${getStatusColor(data?.health.status || '')}`}>
                  {data?.health.status || '--'}
                </div>
                <p className="text-xs text-muted-foreground">Cash reserve health</p>
              </CardContent>
            </Card>
          </div>

          {/* Income Metrics from Pay Stubs */}
          {data?.income && data.income.paycheckCount > 0 && (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Net Pay</CardTitle>
                  <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(data.income.averageNetPay)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Per paycheck ({data.income.paycheckCount} this year)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(data.income.expectedMonthlyIncome)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {PAY_FREQUENCY_LABELS[data.income.payFrequency]}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Income vs Expenses</CardTitle>
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${data.income.incomeVsExpenses >= 1 ? 'text-green-600' : 'text-red-600'}`}>
                    {data.income.incomeVsExpenses > 0
                      ? `${(data.income.incomeVsExpenses * 100).toFixed(0)}%`
                      : '--'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data.income.incomeVsExpenses >= 1
                      ? `+${formatCurrency(data.income.expectedMonthlyIncome - (data.health.monthlyExpenseAverage || 0))}/mo surplus`
                      : data.income.incomeVsExpenses > 0
                        ? `${formatCurrency((data.health.monthlyExpenseAverage || 0) - data.income.expectedMonthlyIncome)}/mo shortfall`
                        : 'Add expenses to compare'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">YTD Income</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(data.income.ytdTotalIncome)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From synced pay stubs
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabbed Content - Coverage, Accounts, Quick Links */}
          <div className="mt-8">
            <Tabs defaultValue="coverage">
              <TabsList>
                <TabsTrigger value="coverage">Coverage</TabsTrigger>
                <TabsTrigger value="accounts">Accounts</TabsTrigger>
                <TabsTrigger value="links">Quick Links</TabsTrigger>
              </TabsList>

              <TabsContent value="coverage" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <TermTooltip term="months-covered">Expense Coverage</TermTooltip>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data?.coverage && data.coverage.length > 0 ? (
                        <div className="space-y-6">
                          {data.coverage.map(item => (
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

                  {isAdvanced && (
                    <LearnMore title="Why keep cash reserves?" defaultOpen={false}>
                      <p className="mb-2">
                        <strong><TermTooltip term="emergency-fund">Cash reserves</TermTooltip></strong> (also called an emergency fund)
                        provide a financial safety net for unexpected expenses or income loss.
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        <li><strong>3 months:</strong> Minimum recommended for stable income with job security</li>
                        <li><strong>6 months:</strong> Standard recommendation for most people</li>
                        <li><strong>12 months:</strong> Better for self-employed or variable income</li>
                      </ul>
                      <p className="mt-2">
                        Keep reserves in easily accessible accounts (checking, savings) - not locked in investments.
                      </p>
                    </LearnMore>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="accounts" className="mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Cash Accounts</CardTitle>
                    <Link
                      href="/cash/balances"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      Manage
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {accountBalances.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No cash balances recorded yet.{' '}
                        <Link href="/cash/balances" className="text-primary hover:underline">
                          Add balances
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
              </TabsContent>

              <TabsContent value="links" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Links</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Link
                        href="/pay-statements"
                        className="flex items-center rounded-md border p-3 hover:bg-accent"
                      >
                        <DollarSign className="mr-3 h-4 w-4" />
                        <span className="text-sm">Pay Statements</span>
                      </Link>
                      <Link
                        href="/cash/rsu"
                        className="flex items-center rounded-md border p-3 hover:bg-accent"
                      >
                        <TrendingUp className="mr-3 h-4 w-4" />
                        <span className="text-sm">RSU Vesting Schedule</span>
                      </Link>
                      <Link
                        href="/cash/balances"
                        className="flex items-center rounded-md border p-3 hover:bg-accent"
                      >
                        <Wallet className="mr-3 h-4 w-4" />
                        <span className="text-sm">Cash Balances</span>
                      </Link>
                      <Link
                        href="/cashflow"
                        className="flex items-center rounded-md border p-3 hover:bg-accent"
                      >
                        <ArrowUpDown className="mr-3 h-4 w-4" />
                        <span className="text-sm">Credit Card Spending</span>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </PageContainer>
  )
}
