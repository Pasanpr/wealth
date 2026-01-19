'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Wallet, CreditCard, PieChart, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import Link from 'next/link'

interface DashboardData {
  cash: {
    totalCash: number
    monthsCovered: number
    status: 'healthy' | 'warning' | 'critical'
  }
  spending: {
    currentMonth: number
    monthlyAverage: number
  }
  portfolio: {
    totalValue: number
    needsRebalancing: boolean
  }
  ytdReturn: number | null
}

interface SummaryCardProps {
  title: string
  value: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  status?: 'healthy' | 'warning' | 'critical' | null
}

function SummaryCard({ title, value, description, icon: Icon, href, status }: SummaryCardProps) {
  const getStatusColor = () => {
    if (!status) return ''
    switch (status) {
      case 'healthy': return 'border-green-500'
      case 'warning': return 'border-yellow-500'
      case 'critical': return 'border-red-500'
      default: return ''
    }
  }

  return (
    <Link href={href}>
      <Card className={`transition-colors hover:bg-accent/50 ${status ? `border-l-4 ${getStatusColor()}` : ''}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <PageContainer
      title="Dashboard"
      description="Overview of your financial health"
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Cash Balance"
          value={loading ? '--' : data?.cash.totalCash ? formatCurrency(data.cash.totalCash) : '$0'}
          description={loading ? 'Loading...' : `${formatNumber(data?.cash.monthsCovered || 0, 1)} months covered`}
          icon={Wallet}
          href="/cash"
          status={data?.cash.status}
        />
        <SummaryCard
          title="Monthly Spending"
          value={loading ? '--' : formatCurrency(data?.spending.currentMonth || 0)}
          description={loading ? 'Loading...' : `Avg: ${formatCurrency(data?.spending.monthlyAverage || 0)}`}
          icon={CreditCard}
          href="/spending"
        />
        <SummaryCard
          title="Net Worth"
          value={loading ? '--' : formatCurrency(data?.portfolio.totalValue || 0)}
          description={loading ? 'Loading...' : data?.portfolio.needsRebalancing ? 'Rebalancing needed' : 'Portfolio balanced'}
          icon={PieChart}
          href="/portfolio"
        />
        <SummaryCard
          title="YTD Return"
          value={loading ? '--' : data?.ytdReturn != null ? `${(data.ytdReturn * 100).toFixed(1)}%` : '--'}
          description="Portfolio performance"
          icon={TrendingUp}
          href="/portfolio/returns"
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Link
                href="/spending/entry"
                className="flex items-center rounded-md border p-3 hover:bg-accent"
              >
                <CreditCard className="mr-3 h-4 w-4" />
                <span className="text-sm">Enter monthly spending</span>
              </Link>
              <Link
                href="/portfolio/holdings"
                className="flex items-center rounded-md border p-3 hover:bg-accent"
              >
                <PieChart className="mr-3 h-4 w-4" />
                <span className="text-sm">Update holdings</span>
              </Link>
              <Link
                href="/cash/health"
                className="flex items-center rounded-md border p-3 hover:bg-accent"
              >
                <Wallet className="mr-3 h-4 w-4" />
                <span className="text-sm">Update cash balances</span>
              </Link>
              <Link
                href="/import"
                className="flex items-center rounded-md border p-3 hover:bg-accent"
              >
                <TrendingUp className="mr-3 h-4 w-4" />
                <span className="text-sm">Import data from CSV</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>Welcome to Wealth! Here&apos;s how to get started:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>
                  <Link href="/settings/asset-classes" className="text-primary hover:underline">
                    Set up asset classes
                  </Link> and target allocations
                </li>
                <li>
                  <Link href="/settings/securities" className="text-primary hover:underline">
                    Add securities
                  </Link> you hold (funds, ETFs)
                </li>
                <li>
                  <Link href="/portfolio/accounts" className="text-primary hover:underline">
                    Create accounts
                  </Link> (brokerage, IRA, 401k)
                </li>
                <li>
                  <Link href="/spending/cards" className="text-primary hover:underline">
                    Add credit cards
                  </Link> to track spending
                </li>
                <li>
                  <Link href="/import" className="text-primary hover:underline">
                    Import historical data
                  </Link> via CSV
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Alerts */}
      {data && (
        <div className="mt-6 space-y-3">
          {data.cash.status === 'critical' && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="font-medium text-red-900">Low Cash Reserves</p>
                <p className="text-sm text-red-700">
                  Your cash reserves cover less than half of your target months. Consider building your emergency fund.
                </p>
              </div>
            </div>
          )}
          {data.cash.status === 'warning' && (
            <div className="flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-900">Cash Reserves Below Target</p>
                <p className="text-sm text-yellow-700">
                  Your cash reserves are below your target. Consider increasing your savings.
                </p>
              </div>
            </div>
          )}
          {data.portfolio.needsRebalancing && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">Portfolio Rebalancing Recommended</p>
                <p className="text-sm text-blue-700">
                  Some allocations have drifted beyond your threshold.{' '}
                  <Link href="/portfolio/allocation" className="underline">
                    View recommendations
                  </Link>
                </p>
              </div>
            </div>
          )}
          {data.cash.status === 'healthy' && !data.portfolio.needsRebalancing && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-900">Everything looks good!</p>
                <p className="text-sm text-green-700">
                  Your cash reserves are healthy and your portfolio is balanced.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  )
}
