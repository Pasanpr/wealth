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
  TermTooltip,
} from '@/components/ui'
import { formatCurrency, formatPercent, formatDate } from '@/lib/utils/format'
import { ReturnMetrics, AccountWithType } from '@/lib/types'
import { TrendingUp, TrendingDown, DollarSign, Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { useDisplayMode } from '@/lib/context/display-mode'
import { LearnMore } from '@/components/ui/learn-more'

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnMetrics | null>(null)
  const [accounts, setAccounts] = useState<AccountWithType[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAllMetrics, setShowAllMetrics] = useState(false)
  const { isSimple } = useDisplayMode()

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

          {/* Educational section - shown in simple mode */}
          {isSimple && !showAllMetrics && (
            <LearnMore title="Understanding your returns" className="mb-6">
              <p className="mb-2">
                Your portfolio return shows how much your investments have grown (or shrunk) over time.
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Positive return:</strong> Your investments have gained value</li>
                <li><strong>Negative return:</strong> Your investments have lost value (this is normal in short periods)</li>
                <li><strong>Compare to benchmarks:</strong> The S&P 500 averages about 10% per year historically</li>
              </ul>
              <p className="mt-2 text-muted-foreground/80 italic">
                Tip: Focus on long-term returns (years) rather than short-term fluctuations.
              </p>
            </LearnMore>
          )}

          {/* Simple Mode: Main metric with explanation */}
          {isSimple && !showAllMetrics && (
            <Card className="mb-6 bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/30">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Your Portfolio Return</p>
                    <div className={`text-4xl font-bold ${getReturnColor(returns.timeWeightedReturn)}`}>
                      {returns.timeWeightedReturn >= 0 ? '+' : ''}{formatPercent(returns.timeWeightedReturn)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {returns.timeWeightedReturn >= 0
                        ? 'Your investments have grown!'
                        : 'Your investments have decreased in value.'}
                    </p>
                  </div>
                  {getReturnIcon(returns.timeWeightedReturn)}
                </div>
                <button
                  onClick={() => setShowAllMetrics(true)}
                  className="flex items-center gap-1 text-sm text-primary mt-4 hover:underline"
                >
                  Show more details
                  <ChevronDown className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          )}

          {/* Return Metrics - Show in advanced mode or when expanded */}
          {(!isSimple || showAllMetrics) && (
            <>
              {isSimple && showAllMetrics && (
                <button
                  onClick={() => setShowAllMetrics(false)}
                  className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-primary"
                >
                  <ChevronUp className="h-4 w-4" />
                  Show less
                </button>
              )}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      <TermTooltip term="simple-return">Simple Return</TermTooltip>
                    </CardTitle>
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

                <Card className="ring-2 ring-primary/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      <TermTooltip term="twr">Time-Weighted (TWR)</TermTooltip>
                      <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">Recommended</span>
                    </CardTitle>
                    {getReturnIcon(returns.timeWeightedReturn)}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getReturnColor(returns.timeWeightedReturn)}`}>
                      {returns.timeWeightedReturn >= 0 ? '+' : ''}{formatPercent(returns.timeWeightedReturn)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Best for comparing to benchmarks
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      <TermTooltip term="mwr">Money-Weighted (MWR)</TermTooltip>
                    </CardTitle>
                    {getReturnIcon(returns.moneyWeightedReturn)}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getReturnColor(returns.moneyWeightedReturn)}`}>
                      {returns.moneyWeightedReturn >= 0 ? '+' : ''}{formatPercent(returns.moneyWeightedReturn)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your actual dollar returns
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      <TermTooltip term="annualized-return">Annualized</TermTooltip>
                    </CardTitle>
                    {getReturnIcon(returns.annualizedReturn)}
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getReturnColor(returns.annualizedReturn)}`}>
                      {returns.annualizedReturn >= 0 ? '+' : ''}{formatPercent(returns.annualizedReturn)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Yearly rate based on TWR
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

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

              {(!isSimple || showAllMetrics) && (
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
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </PageContainer>
  )
}
