'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, TermTooltip } from '@/components/ui'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { AllocationItem } from '@/lib/types'
import { ArrowUp, ArrowDown, Minus, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useDisplayMode } from '@/lib/context/display-mode'
import { LearnMore } from '@/components/ui/learn-more'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts'

interface AllocationData {
  allocations: AllocationItem[]
  totalValue: number
  threshold: number
  needsRebalancing: boolean
  accountBreakdown: {
    accountId: number
    accountName: string
    value: number
    percentage: number
  }[]
}

export default function AllocationPage() {
  const [data, setData] = useState<AllocationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDetails, setShowDetails] = useState(false)
  const { isSimple } = useDisplayMode()

  useEffect(() => {
    fetch('/api/portfolio/allocation')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const chartData = data?.allocations
    .filter(a => a.currentAllocation > 0 || a.targetAllocation > 0)
    .map(a => ({
      name: a.assetClass,
      current: a.currentAllocation * 100,
      target: a.targetAllocation * 100,
    })) || []

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'buy':
        return <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-300" />
      case 'sell':
        return <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-300" />
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'buy':
        return 'text-green-600 dark:text-green-300'
      case 'sell':
        return 'text-red-600 dark:text-red-300'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <PageContainer
      title={<TermTooltip term="asset-allocation">Asset Allocation</TermTooltip>}
      description="View how your investments are divided and get rebalancing suggestions"
    >
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !data || data.totalValue === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No holdings data available. Add holdings to see allocation analysis.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Status Card */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {data.needsRebalancing ? (
                  <AlertTriangle className="h-8 w-8 text-yellow-600" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-300" />
                )}
                <div>
                  <h3 className="text-xl font-semibold mb-1">
                    {data.needsRebalancing ? (
                      <><TermTooltip term="rebalancing">Rebalancing</TermTooltip> Recommended</>
                    ) : (
                      'Portfolio Balanced'
                    )}
                  </h3>
                  <p className="text-muted-foreground">
                    {data.needsRebalancing
                      ? `Some investments have drifted more than ${data.threshold}% from your targets.`
                      : `All investments are within ${data.threshold}% of your targets.`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Educational section - show when rebalancing is needed */}
          {data.needsRebalancing && (
            <LearnMore title="How to rebalance your portfolio" className="mb-6">
              <p className="mb-2">
                Rebalancing brings your portfolio back to your target allocation. Here are your options:
              </p>
              <ol className="list-decimal list-inside space-y-2">
                <li><strong>Sell overweight assets:</strong> Sell investments that are above your target percentage</li>
                <li><strong>Buy underweight assets:</strong> Use the proceeds to buy investments below target</li>
                <li><strong>Add new money strategically:</strong> When adding to your portfolio, buy the underweight assets</li>
              </ol>
              <p className="mt-2 text-muted-foreground/80 italic">
                Tip: Many brokerages let you set up automatic rebalancing in retirement accounts.
              </p>
            </LearnMore>
          )}

          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-bold">{formatCurrency(data.totalValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      <TermTooltip term="threshold">Rebalance Threshold</TermTooltip>
                    </span>
                    <span>{data.threshold}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Asset Classes</span>
                    <span>{data.allocations.filter(a => a.currentValue > 0).length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Current vs Target</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value) => typeof value === 'number' ? `${value.toFixed(1)}%` : value} />
                        <Legend />
                        <Bar dataKey="current" name="Current" fill="hsl(222.2 47.4% 11.2%)" />
                        <Bar dataKey="target" name="Target" fill="hsl(210 40% 80%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No allocation data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Allocation Table - Simplified for simple mode */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{isSimple ? 'What to Do' : 'Allocation Details'}</CardTitle>
                {isSimple && (
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
                  >
                    {showDetails ? 'Hide details' : 'Show details'}
                    {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isSimple && !showDetails ? (
                // Simple mode: Show actionable cards
                <div className="space-y-3">
                  {data.allocations
                    .filter(item => item.action !== 'hold')
                    .map(item => (
                      <div
                        key={item.assetClass}
                        className={`flex items-center justify-between p-4 rounded-lg border ${
                          item.action === 'buy'
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-red-500/10 border-red-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {getActionIcon(item.action)}
                          <div>
                            <p className="font-medium">{item.assetClass}</p>
                            <p className={`text-sm ${getActionColor(item.action)}`}>
                              {item.action === 'buy' ? 'Buy more' : 'Sell some'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${getActionColor(item.action)}`}>
                            {formatCurrency(item.actionAmount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  {data.allocations.filter(item => item.action !== 'hold').length === 0 && (
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
                      <p className="text-sm">All your investments are balanced. No action needed.</p>
                    </div>
                  )}
                </div>
              ) : (
                // Advanced mode or expanded: Full table
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3 text-left">Asset Class</th>
                        <th className="p-3 text-right">Current Value</th>
                        <th className="p-3 text-right">Current %</th>
                        <th className="p-3 text-right">Target %</th>
                        {(!isSimple || showDetails) && <th className="p-3 text-right">Difference</th>}
                        <th className="p-3 text-center">Action</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.allocations.map(item => (
                        <tr key={item.assetClass} className="border-b">
                          <td className="p-3 font-medium">{item.assetClass}</td>
                          <td className="p-3 text-right">{formatCurrency(item.currentValue)}</td>
                          <td className="p-3 text-right">{formatPercent(item.currentAllocation)}</td>
                          <td className="p-3 text-right">{formatPercent(item.targetAllocation)}</td>
                          {(!isSimple || showDetails) && (
                            <td className={`p-3 text-right ${item.difference > 0 ? 'text-red-600 dark:text-red-300' : item.difference < 0 ? 'text-green-600 dark:text-green-300' : ''}`}>
                              {item.difference > 0 ? '+' : ''}{formatPercent(item.difference)}
                            </td>
                          )}
                          <td className="p-3">
                            <div className={`flex items-center justify-center gap-1 capitalize ${getActionColor(item.action)}`}>
                              {getActionIcon(item.action)}
                              {item.action}
                            </div>
                          </td>
                          <td className={`p-3 text-right ${getActionColor(item.action)}`}>
                            {item.actionAmount > 0 ? formatCurrency(item.actionAmount) : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-muted/50">
                        <td className="p-3">Total</td>
                        <td className="p-3 text-right">{formatCurrency(data.totalValue)}</td>
                        <td className="p-3 text-right">100%</td>
                        <td className="p-3 text-right">100%</td>
                        {(!isSimple || showDetails) && <td className="p-3"></td>}
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  )
}
