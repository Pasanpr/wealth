'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { formatCurrency, formatPercentChange } from '@/lib/utils/format'
import { CreditCard } from '@/lib/types'
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
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

interface TrendData {
  year: number
  month: number
  totalCredit: number
  cardBreakdown: { cardId: number; cardName: string; balance: number }[]
}

interface Stats {
  average: number
  median: number
  min: number
  max: number
  total: number
  count: number
}

export default function CashFlowTrendsPage() {
  const [cards, setCards] = useState<CreditCard[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  const fetchTrendData = async () => {
    setLoading(true)
    try {
      // Fetch last 24 months of data
      const currentYear = new Date().getFullYear()
      const years = [currentYear, currentYear - 1]
      const allData: TrendData[] = []

      for (const year of years) {
        const res = await fetch(`/api/cashflow?year=${year}`)
        const data = await res.json()

        if (data.cards) {
          setCards(data.cards)
        }

        for (const month of data.months) {
          if (month.totalCredit > 0) {
            allData.push({
              year,
              month: month.month,
              totalCredit: month.totalCredit,
              cardBreakdown: month.cardBalances,
            })
          }
        }
      }

      // Sort by date
      allData.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })

      setTrendData(allData)

      // Calculate stats for selected year
      const yearData = allData.filter(d => d.year === parseInt(selectedYear))
      if (yearData.length > 0) {
        const totals = yearData.map(d => d.totalCredit)
        const sorted = [...totals].sort((a, b) => a - b)
        const sum = totals.reduce((a, b) => a + b, 0)

        setStats({
          average: sum / totals.length,
          median: sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)],
          min: sorted[0],
          max: sorted[sorted.length - 1],
          total: sum,
          count: totals.length,
        })
      } else {
        setStats(null)
      }
    } catch (error) {
      console.error('Failed to fetch trend data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTrendData()
  }, [selectedYear])

  // Prepare chart data
  const lineChartData = trendData.map(d => ({
    name: `${d.year}-${String(d.month).padStart(2, '0')}`,
    total: d.totalCredit,
  }))

  // YoY comparison data
  const yoyData = MONTHS.map((monthName, idx) => {
    const month = idx + 1
    const currentYearData = trendData.find(d => d.year === parseInt(selectedYear) && d.month === month)
    const prevYearData = trendData.find(d => d.year === parseInt(selectedYear) - 1 && d.month === month)

    return {
      name: monthName,
      [parseInt(selectedYear) - 1]: prevYearData?.totalCredit || 0,
      [selectedYear]: currentYearData?.totalCredit || 0,
    }
  })

  // Per-card trend data (stacked or individual)
  const cardChartData = trendData.map(d => {
    const entry: Record<string, number | string> = {
      name: `${d.year}-${String(d.month).padStart(2, '0')}`,
    }
    d.cardBreakdown.forEach(cb => {
      entry[cb.cardName] = cb.balance
    })
    return entry
  })

  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y)
  }

  return (
    <PageContainer
      title="Spending Trends"
      description="Analyze your credit card spending patterns over time"
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
          {stats && (
            <div className="grid gap-4 md:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Average</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.average)}</div>
                  <p className="text-xs text-muted-foreground">Per month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Median</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.median)}</div>
                  <p className="text-xs text-muted-foreground">Per month</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Min / Max</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-bold">
                    {formatCurrency(stats.min)} - {formatCurrency(stats.max)}
                  </div>
                  <p className="text-xs text-muted-foreground">Range</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Year Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
                  <p className="text-xs text-muted-foreground">{stats.count} months</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* YoY Comparison Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Year over Year Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              {yoyData.some(d => (d[selectedYear] as number) > 0 || (d[parseInt(selectedYear) - 1] as number) > 0) ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                      <Legend />
                      <Bar
                        dataKey={parseInt(selectedYear) - 1}
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
                  No comparison data available.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Historical Trend Line */}
          {lineChartData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Total Credit Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={2}
                      />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                      <Line
                        type="monotone"
                        dataKey="total"
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

          {/* Per-Card Breakdown */}
          {cardChartData.length > 0 && cards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Per-Card Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cardChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={2}
                      />
                      <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                      <Legend />
                      {cards.map((card, idx) => (
                        <Line
                          key={card.id}
                          type="monotone"
                          dataKey={card.name}
                          stroke={COLORS[idx % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
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
