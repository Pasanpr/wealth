'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { PieChart, Briefcase, TrendingUp, BarChart3, Upload } from 'lucide-react'
import Link from 'next/link'
import {
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'

interface AllocationData {
  allocations: {
    assetClass: string
    currentValue: number
    currentAllocation: number
    targetAllocation: number
  }[]
  totalValue: number
  accountBreakdown: {
    accountId: number
    accountName: string
    value: number
    percentage: number
  }[]
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300']

export default function PortfolioOverview() {
  const [data, setData] = useState<AllocationData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/portfolio/allocation')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const pieData = data?.allocations
    .filter(a => a.currentValue > 0)
    .map(a => ({
      name: a.assetClass,
      value: a.currentValue,
    })) || []

  return (
    <PageContainer
      title="Portfolio Overview"
      description="Your total net worth and asset allocation"
    >
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Net Worth Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Net Worth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">
                {data?.totalValue ? formatCurrency(data.totalValue) : '--'}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Total portfolio value across all accounts
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {/* Asset Allocation Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Asset Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value}
                        />
                        <Legend />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No holdings data available.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick Links */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Links</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <Link
                    href="/portfolio/accounts"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <Briefcase className="mr-3 h-4 w-4" />
                    <span className="text-sm">Manage Accounts</span>
                  </Link>
                  <Link
                    href="/portfolio/holdings"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <PieChart className="mr-3 h-4 w-4" />
                    <span className="text-sm">Update Holdings</span>
                  </Link>
                  <Link
                    href="/portfolio/allocation"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <BarChart3 className="mr-3 h-4 w-4" />
                    <span className="text-sm">Allocation & Rebalancing</span>
                  </Link>
                  <Link
                    href="/portfolio/returns"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <TrendingUp className="mr-3 h-4 w-4" />
                    <span className="text-sm">Return Analysis</span>
                  </Link>
                  <Link
                    href="/portfolio/import"
                    className="flex items-center rounded-md border p-3 hover:bg-accent"
                  >
                    <Upload className="mr-3 h-4 w-4" />
                    <span className="text-sm">Import Vanguard CSV</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account Breakdown */}
          {data?.accountBreakdown && data.accountBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Account Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.accountBreakdown.map(account => (
                    <div key={account.accountId}>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{account.accountName}</span>
                        <span>{formatCurrency(account.value)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${account.percentage * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {formatPercent(account.percentage)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  )
}
