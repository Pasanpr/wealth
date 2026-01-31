'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Button, Progress } from '@/components/ui'
import { Wallet, CreditCard, PieChart, TrendingUp, AlertCircle, CheckCircle, Circle, X, Sparkles, ArrowRight } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import Link from 'next/link'
import { OnboardingProgress } from './api/onboarding/route'

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

function OnboardingStep({ done, href, label }: { done: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
        done
          ? 'text-green-600 dark:text-green-400'
          : 'text-muted-foreground hover:bg-muted/50'
      }`}
    >
      {done ? (
        <CheckCircle className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Circle className="h-4 w-4 flex-shrink-0" />
      )}
      <span className={done ? 'line-through opacity-70' : ''}>{label}</span>
    </Link>
  )
}

function SummaryCard({ title, value, description, icon: Icon, href, status }: SummaryCardProps) {
  const getCardColors = () => {
    // Assign vibrant colors based on card type - theme-aware
    if (title === 'Cash Balance') {
      return 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 dark:from-emerald-500/20 dark:to-teal-500/20 border-emerald-500/50 dark:border-emerald-500/40'
    }
    if (title === 'Monthly Spending') {
      return 'bg-gradient-to-br from-purple-500/30 to-pink-500/30 dark:from-purple-500/20 dark:to-pink-500/20 border-purple-500/50 dark:border-purple-500/40'
    }
    if (title === 'Net Worth') {
      return 'bg-gradient-to-br from-blue-500/30 to-cyan-500/30 dark:from-blue-500/20 dark:to-cyan-500/20 border-blue-500/50 dark:border-blue-500/40'
    }
    if (title === 'YTD Return') {
      return 'bg-gradient-to-br from-orange-500/30 to-amber-500/30 dark:from-orange-500/20 dark:to-amber-500/20 border-orange-500/50 dark:border-orange-500/40'
    }
    return 'bg-gradient-to-br from-slate-500/30 to-gray-500/30 dark:from-slate-500/20 dark:to-gray-500/20 border-slate-500/50 dark:border-slate-500/40'
  }

  const getIconColor = () => {
    if (title === 'Cash Balance') return 'text-emerald-600 dark:text-emerald-300'
    if (title === 'Monthly Spending') return 'text-purple-600 dark:text-purple-300'
    if (title === 'Net Worth') return 'text-blue-600 dark:text-blue-300'
    if (title === 'YTD Return') return 'text-orange-600 dark:text-orange-300'
    return 'text-muted-foreground'
  }

  const getStatusColor = () => {
    if (!status) return ''
    switch (status) {
      case 'healthy': return 'border-l-4 border-l-emerald-500'
      case 'warning': return 'border-l-4 border-l-yellow-500'
      case 'critical': return 'border-l-4 border-l-red-500'
      default: return ''
    }
  }

  return (
    <Link href={href}>
      <Card className={`transition-all hover:scale-[1.02] hover:shadow-xl ${getCardColors()} ${getStatusColor()}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
          <Icon className={`h-5 w-5 ${getIconColor()}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{value}</div>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [onboarding, setOnboarding] = useState<OnboardingProgress | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))

    fetch('/api/onboarding')
      .then(res => res.json())
      .then(setOnboarding)
      .catch(console.error)
  }, [])

  const dismissOnboarding = async () => {
    await fetch('/api/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed: true }),
    })
    setOnboarding(prev => prev ? { ...prev, dismissed: true } : null)
  }

  const showOnboarding = onboarding && !onboarding.dismissed && onboarding.percentComplete < 100

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
          href="/cashflow"
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
        <Card className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 dark:from-purple-500/10 dark:to-pink-500/10 border-purple-500/40 dark:border-purple-500/30">
          <CardHeader>
            <CardTitle className="text-purple-700 dark:text-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Link
                href="/cashflow/entry"
                className="flex items-center rounded-lg border border-purple-500/40 dark:border-purple-500/30 bg-gradient-to-r from-purple-500/20 to-pink-500/20 dark:from-purple-500/10 dark:to-pink-500/10 p-3 hover:from-purple-500/30 hover:to-pink-500/30 dark:hover:from-purple-500/20 dark:hover:to-pink-500/20 transition-all hover:scale-[1.02]"
              >
                <CreditCard className="mr-3 h-4 w-4 text-purple-600 dark:text-purple-300" />
                <span className="text-sm text-foreground">Enter monthly spending</span>
              </Link>
              <Link
                href="/portfolio/holdings"
                className="flex items-center rounded-lg border border-blue-500/40 dark:border-blue-500/30 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 dark:from-blue-500/10 dark:to-cyan-500/10 p-3 hover:from-blue-500/30 hover:to-cyan-500/30 dark:hover:from-blue-500/20 dark:hover:to-cyan-500/20 transition-all hover:scale-[1.02]"
              >
                <PieChart className="mr-3 h-4 w-4 text-blue-600 dark:text-blue-300" />
                <span className="text-sm text-foreground">Update holdings</span>
              </Link>
              <Link
                href="/cash/health"
                className="flex items-center rounded-lg border border-emerald-500/40 dark:border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 dark:from-emerald-500/10 dark:to-teal-500/10 p-3 hover:from-emerald-500/30 hover:to-teal-500/30 dark:hover:from-emerald-500/20 dark:hover:to-teal-500/20 transition-all hover:scale-[1.02]"
              >
                <Wallet className="mr-3 h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                <span className="text-sm text-foreground">Update cash balances</span>
              </Link>
              <Link
                href="/import"
                className="flex items-center rounded-lg border border-orange-500/40 dark:border-orange-500/30 bg-gradient-to-r from-orange-500/20 to-amber-500/20 dark:from-orange-500/10 dark:to-amber-500/10 p-3 hover:from-orange-500/30 hover:to-amber-500/30 dark:hover:from-orange-500/20 dark:hover:to-amber-500/20 transition-all hover:scale-[1.02]"
              >
                <TrendingUp className="mr-3 h-4 w-4 text-orange-600 dark:text-orange-300" />
                <span className="text-sm text-foreground">Import data from CSV</span>
              </Link>
            </div>
          </CardContent>
        </Card>

        {showOnboarding ? (
          <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/10 dark:to-cyan-500/10 border-blue-500/40 dark:border-blue-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-blue-700 dark:text-foreground">Getting Started</CardTitle>
                <button
                  onClick={dismissOnboarding}
                  className="text-muted-foreground hover:text-foreground"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Setup Progress</span>
                  <span className="font-medium">{onboarding.completedSteps} of {onboarding.totalSteps}</span>
                </div>
                <Progress value={onboarding.percentComplete} className="h-2" />
              </div>
              <div className="space-y-2 text-sm">
                <OnboardingStep
                  done={onboarding.asset_classes_done}
                  href="/settings/asset-classes"
                  label="Set up asset classes"
                />
                <OnboardingStep
                  done={onboarding.securities_done}
                  href="/settings/securities"
                  label="Add securities"
                />
                <OnboardingStep
                  done={onboarding.accounts_done}
                  href="/portfolio/accounts"
                  label="Create accounts"
                />
                <OnboardingStep
                  done={onboarding.credit_cards_done}
                  href="/cashflow/cards"
                  label="Add credit cards"
                />
                <OnboardingStep
                  done={onboarding.import_done}
                  href="/import"
                  label="Import data"
                />
              </div>
              <Button asChild className="w-full mt-4" size="sm">
                <Link href="/onboarding">
                  Continue Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : onboarding && onboarding.percentComplete === 100 && !onboarding.dismissed ? (
          <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 dark:from-green-500/10 dark:to-emerald-500/10 border-green-500/40 dark:border-green-500/30">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-green-700 dark:text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Setup Complete
                </CardTitle>
                <button
                  onClick={dismissOnboarding}
                  className="text-muted-foreground hover:text-foreground"
                  title="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Great job! Your financial dashboard is all set up. You can always add more data or adjust settings later.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 dark:from-blue-500/10 dark:to-cyan-500/10 border-blue-500/40 dark:border-blue-500/30">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-foreground">Quick Links</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 text-sm">
                <Link href="/settings/asset-classes" className="text-primary hover:underline">Asset Classes</Link>
                <Link href="/settings/securities" className="text-primary hover:underline">Securities</Link>
                <Link href="/portfolio/accounts" className="text-primary hover:underline">Accounts</Link>
                <Link href="/settings/glossary" className="text-primary hover:underline">Financial Glossary</Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Status Alerts */}
      {data && (
        <div className="mt-6 space-y-3">
          {data.cash.status === 'critical' && (
            <div className="flex items-center gap-3 p-4 bg-red-500/20 dark:bg-red-500/10 border border-red-500/40 dark:border-red-500/30 rounded-xl backdrop-blur-sm">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-200">Low Cash Reserves</p>
                <p className="text-sm text-red-600/90 dark:text-red-100/90">
                  Your cash reserves cover less than half of your target months. Consider building your emergency fund.
                </p>
              </div>
            </div>
          )}
          {data.cash.status === 'warning' && (
            <div className="flex items-center gap-3 p-4 bg-yellow-500/20 dark:bg-yellow-500/10 border border-yellow-500/40 dark:border-yellow-500/30 rounded-xl backdrop-blur-sm">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-300" />
              <div>
                <p className="font-medium text-yellow-700 dark:text-yellow-200">Cash Reserves Below Target</p>
                <p className="text-sm text-yellow-600/90 dark:text-yellow-100/90">
                  Your cash reserves are below your target. Consider increasing your savings.
                </p>
              </div>
            </div>
          )}
          {data.portfolio.needsRebalancing && (
            <div className="flex items-center gap-3 p-4 bg-primary/20 dark:bg-primary/10 border border-primary/40 dark:border-primary/30 rounded-xl backdrop-blur-sm">
              <AlertCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-primary">Portfolio Rebalancing Recommended</p>
                <p className="text-sm text-muted-foreground">
                  Some allocations have drifted beyond your threshold.{' '}
                  <Link href="/portfolio/allocation" className="text-primary underline hover:text-primary/80">
                    View recommendations
                  </Link>
                </p>
              </div>
            </div>
          )}
          {data.cash.status === 'healthy' && !data.portfolio.needsRebalancing && (
            <div className="flex items-center gap-3 p-4 bg-green-500/20 dark:bg-green-500/10 border border-green-500/40 dark:border-green-500/30 rounded-xl backdrop-blur-sm">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-300" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-200">Everything looks good!</p>
                <p className="text-sm text-green-600/90 dark:text-green-100/90">
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
