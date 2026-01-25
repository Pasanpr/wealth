'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { DollarSign, TrendingUp, Wallet, AlertCircle, Calendar, ArrowUpDown } from 'lucide-react'
import Link from 'next/link'

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

const PAY_FREQUENCY_LABELS: Record<string, string> = {
  biweekly: 'Bi-weekly (every 2 weeks)',
  semimonthly: 'Semi-monthly (2x/month)',
  monthly: 'Monthly',
  unknown: 'Unknown',
}

export default function CashOverview() {
  const [data, setData] = useState<CashHealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cash-health')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
      default: return 'text-muted-foreground'
    }
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

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <Link
                    href="/cash/income"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <DollarSign className="mr-3 h-4 w-4" />
                    <span className="text-sm">Manage Income Records</span>
                  </Link>
                  <Link
                    href="/cash/rsu"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <TrendingUp className="mr-3 h-4 w-4" />
                    <span className="text-sm">RSU Vesting Schedule</span>
                  </Link>
                  <Link
                    href="/cash/expenses"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <Wallet className="mr-3 h-4 w-4" />
                    <span className="text-sm">Yearly Expenses</span>
                  </Link>
                  <Link
                    href="/cash/health"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <AlertCircle className="mr-3 h-4 w-4" />
                    <span className="text-sm">Cash Health Analysis</span>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expense Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.coverage && data.coverage.length > 0 ? (
                  <div className="space-y-4">
                    {data.coverage.map(item => (
                      <div key={item.months} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span>{item.months} Month{item.months > 1 ? 's' : ''}</span>
                          <span className={item.coverage >= 1 ? 'text-green-600' : 'text-red-600'}>
                            {item.coverage >= 1 ? 'Covered' : `${(item.coverage * 100).toFixed(0)}%`}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary">
                          <div
                            className={`h-2 rounded-full ${item.coverage >= 1 ? 'bg-green-600' : 'bg-yellow-600'}`}
                            style={{ width: `${Math.min(item.coverage * 100, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Need: {formatCurrency(item.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Add cash balances and yearly expenses to see coverage analysis.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </PageContainer>
  )
}
