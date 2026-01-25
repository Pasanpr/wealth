'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DollarSign,
  TrendingDown,
  Minus,
  Building2,
  Wallet,
} from 'lucide-react'

interface PaySummaryProps {
  grossEarnings: number
  totalTaxes: number
  totalDeductions: number
  employerBenefits: number
  netPay: number
  title?: string
  subtitle?: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

interface SummaryCardProps {
  title: string
  amount: number
  icon: React.ComponentType<{ className?: string }>
  colorClass?: string
  isNegative?: boolean
}

function SummaryCard({
  title,
  amount,
  icon: Icon,
  colorClass = '',
  isNegative = false,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${colorClass || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>
          {isNegative && amount > 0 ? '-' : ''}
          {formatCurrency(amount)}
        </div>
      </CardContent>
    </Card>
  )
}

export function PaySummary({
  grossEarnings,
  totalTaxes,
  totalDeductions,
  employerBenefits,
  netPay,
  title,
  subtitle,
}: PaySummaryProps) {
  return (
    <div className="space-y-4">
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="Gross Earnings"
          amount={grossEarnings}
          icon={DollarSign}
        />
        <SummaryCard
          title="Taxes"
          amount={totalTaxes}
          icon={TrendingDown}
          colorClass="text-red-500"
          isNegative
        />
        <SummaryCard
          title="Deductions"
          amount={totalDeductions}
          icon={Minus}
          colorClass="text-red-500"
          isNegative
        />
        <SummaryCard
          title="Employer Benefits"
          amount={employerBenefits}
          icon={Building2}
          colorClass="text-green-500"
        />
        <SummaryCard
          title="Net Pay"
          amount={netPay}
          icon={Wallet}
          colorClass="text-primary"
        />
      </div>
    </div>
  )
}
