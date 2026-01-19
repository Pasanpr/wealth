'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { formatCurrency, formatMonth } from '@/lib/utils/format'
import { SpendingStats, MonthlySpending } from '@/lib/types'
import { CreditCard, TrendingUp, TrendingDown, DollarSign } from 'lucide-react'
import Link from 'next/link'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface SpendingData {
  stats: SpendingStats
  trend: MonthlySpending[]
}

export default function SpendingOverview() {
  const [data, setData] = useState<SpendingData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/spending/stats')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const chartData = data?.trend.map(t => ({
    name: formatMonth(t.year, t.month),
    amount: t.amount,
  })) || []

  return (
    <PageContainer
      title="Spending"
      description="Track and analyze your credit card spending"
    >
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Monthly</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.stats.average ? formatCurrency(data.stats.average) : '--'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Median Monthly</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.stats.median ? formatCurrency(data.stats.median) : '--'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lowest Month</CardTitle>
                <TrendingDown className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.stats.min ? formatCurrency(data.stats.min) : '--'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Highest Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.stats.max ? formatCurrency(data.stats.max) : '--'}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <Link
                    href="/spending/entry"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <DollarSign className="mr-3 h-4 w-4" />
                    <span className="text-sm">Enter Monthly Spending</span>
                  </Link>
                  <Link
                    href="/spending/cards"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <CreditCard className="mr-3 h-4 w-4" />
                    <span className="text-sm">Manage Credit Cards</span>
                  </Link>
                  <Link
                    href="/spending/trends"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <TrendingUp className="mr-3 h-4 w-4" />
                    <span className="text-sm">View Trends & Analysis</span>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Tracked</span>
                    <span className="font-medium">
                      {data?.stats.total ? formatCurrency(data.stats.total) : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Months of Data</span>
                    <span className="font-medium">{data?.stats.count || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Spending Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => typeof value === 'number' ? [formatCurrency(value), 'Spending'] : value}
                      />
                      <Line
                        type="monotone"
                        dataKey="amount"
                        stroke="hsl(222.2 47.4% 11.2%)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  )
}
