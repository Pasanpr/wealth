'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { formatCurrency, formatPercentChange } from '@/lib/utils/format'
import { SpendingStats, MonthlySpending, YoYComparison } from '@/lib/types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface StatsData {
  stats: SpendingStats
  yoyComparison: YoYComparison[]
  trend: MonthlySpending[]
}

export default function SpendingTrendsPage() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/spending/stats?year=${selectedYear}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  const yoyChartData = data?.yoyComparison.map((item, index) => ({
    name: MONTHS[index],
    [`${parseInt(selectedYear) - 1}`]: item.previousYear,
    [selectedYear]: item.currentYear,
  })) || []

  const trendChartData = data?.trend.map(t => ({
    name: `${t.year}-${String(t.month).padStart(2, '0')}`,
    amount: t.amount,
  })) || []

  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y)
  }

  return (
    <PageContainer
      title="Spending Trends"
      description="Analyze your spending patterns over time"
    >
      <div className="flex items-center gap-4 mb-6">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={y.toString()}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Average</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.stats.average ? formatCurrency(data.stats.average) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">Per month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Median</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.stats.median ? formatCurrency(data.stats.median) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">Per month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Min / Max</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {data?.stats.min && data?.stats.max
                    ? `${formatCurrency(data.stats.min)} - ${formatCurrency(data.stats.max)}`
                    : '--'}
                </div>
                <p className="text-xs text-muted-foreground">Range</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Year Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data?.stats.total ? formatCurrency(data.stats.total) : '--'}
                </div>
                <p className="text-xs text-muted-foreground">{data?.stats.count || 0} months</p>
              </CardContent>
            </Card>
          </div>

          {/* YoY Comparison */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Year over Year Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {yoyChartData.some(d => (d[selectedYear] as number) > 0 || (d[`${parseInt(selectedYear) - 1}`] as number) > 0) ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                      <Legend />
                      <Bar
                        dataKey={`${parseInt(selectedYear) - 1}`}
                        fill="hsl(210 40% 80%)"
                        name={`${parseInt(selectedYear) - 1}`}
                      />
                      <Bar
                        dataKey={selectedYear}
                        fill="hsl(222.2 47.4% 11.2%)"
                        name={selectedYear}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No comparison data available for {selectedYear} and {parseInt(selectedYear) - 1}.
                </p>
              )}
            </CardContent>
          </Card>

          {/* YoY Table */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Monthly Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">Month</th>
                      <th className="p-2 text-right">{parseInt(selectedYear) - 1}</th>
                      <th className="p-2 text-right">{selectedYear}</th>
                      <th className="p-2 text-right">Change</th>
                      <th className="p-2 text-right">% Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.yoyComparison.map((item, index) => (
                      <tr key={item.month} className="border-b">
                        <td className="p-2">{MONTHS[index]}</td>
                        <td className="p-2 text-right">
                          {item.previousYear > 0 ? formatCurrency(item.previousYear) : '-'}
                        </td>
                        <td className="p-2 text-right">
                          {item.currentYear > 0 ? formatCurrency(item.currentYear) : '-'}
                        </td>
                        <td className={`p-2 text-right ${item.change > 0 ? 'text-red-600' : item.change < 0 ? 'text-green-600' : ''}`}>
                          {item.change !== 0 ? formatCurrency(item.change) : '-'}
                        </td>
                        <td className={`p-2 text-right ${item.changePercent > 0 ? 'text-red-600' : item.changePercent < 0 ? 'text-green-600' : ''}`}>
                          {item.previousYear > 0 ? formatPercentChange(item.changePercent) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Historical Trend */}
          {trendChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historical Trend (24 months)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={2}
                      />
                      <YAxis
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
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
