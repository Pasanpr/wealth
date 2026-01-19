'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils/format'
import { ReturnMetrics, AccountWithType } from '@/lib/types'
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnMetrics | null>(null)
  const [accounts, setAccounts] = useState<AccountWithType[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/accounts')
      .then(res => res.json())
      .then(setAccounts)
      .catch(console.error)
  }, [])

  useEffect(() => {
    setLoading(true)
    setError(null)

    const url = selectedAccount === 'all'
      ? '/api/portfolio/returns'
      : `/api/portfolio/returns?account_id=${selectedAccount}`

    fetch(url)
      .then(async res => {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to calculate returns')
        }
        return res.json()
      })
      .then(setReturns)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [selectedAccount])

  const getReturnColor = (value: number) => {
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-muted-foreground'
  }

  const getReturnIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-green-600" />
    if (value < 0) return <TrendingDown className="h-4 w-4 text-red-600" />
    return null
  }

  return (
    <PageContainer
      title="Return Analysis"
      description="Calculate and analyze your portfolio returns"
    >
      <div className="mb-6">
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts (Combined)</SelectItem>
            {accounts.map(account => (
              <SelectItem key={account.id} value={account.id.toString()}>
                {account.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Calculating returns...</div>
      ) : error ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      ) : returns ? (
        <>
          {/* Period Info */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  {formatDate(returns.startDate)} to {formatDate(returns.endDate)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Return Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Simple Return</CardTitle>
                {getReturnIcon(returns.simpleReturn)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getReturnColor(returns.simpleReturn)}`}>
                  {returns.simpleReturn >= 0 ? '+' : ''}{formatPercent(returns.simpleReturn)}
                </div>
                <p className="text-xs text-muted-foreground">
                  (End - Start - Flows) / Start
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Time-Weighted (TWR)</CardTitle>
                {getReturnIcon(returns.timeWeightedReturn)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getReturnColor(returns.timeWeightedReturn)}`}>
                  {returns.timeWeightedReturn >= 0 ? '+' : ''}{formatPercent(returns.timeWeightedReturn)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Geometric linking of sub-periods
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Money-Weighted (MWR)</CardTitle>
                {getReturnIcon(returns.moneyWeightedReturn)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getReturnColor(returns.moneyWeightedReturn)}`}>
                  {returns.moneyWeightedReturn >= 0 ? '+' : ''}{formatPercent(returns.moneyWeightedReturn)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Internal rate of return (IRR)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Annualized</CardTitle>
                {getReturnIcon(returns.annualizedReturn)}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${getReturnColor(returns.annualizedReturn)}`}>
                  {returns.annualizedReturn >= 0 ? '+' : ''}{formatPercent(returns.annualizedReturn)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on TWR
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Value Details */}
          <Card>
            <CardHeader>
              <CardTitle>Value Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Starting Value</p>
                    <p className="text-xl font-bold">{formatCurrency(returns.startValue)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Ending Value</p>
                    <p className="text-xl font-bold">{formatCurrency(returns.endValue)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Net Cash Flows</p>
                    <p className={`text-xl font-bold ${returns.netCashFlows >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {returns.netCashFlows >= 0 ? '+' : ''}{formatCurrency(returns.netCashFlows)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <h4 className="font-medium mb-3">Return Calculation Methods</h4>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong>Simple Return:</strong> Basic calculation that adjusts for cash flows.
                    Best for quick comparisons.
                  </p>
                  <p>
                    <strong>Time-Weighted Return (TWR):</strong> Eliminates the impact of cash flow timing.
                    Best for comparing your performance against benchmarks.
                  </p>
                  <p>
                    <strong>Money-Weighted Return (MWR/IRR):</strong> Considers the timing and size of cash flows.
                    Best for understanding your actual dollar returns.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </PageContainer>
  )
}
