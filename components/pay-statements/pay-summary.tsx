'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DollarSign,
  TrendingDown,
  Minus,
  Building2,
  Wallet,
  Info,
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
  description?: string
}

function SummaryCard({
  title,
  amount,
  icon: Icon,
  colorClass = '',
  isNegative = false,
  description,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Info className="h-3.5 w-3.5" />
                  <span className="sr-only">Info about {title}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left">
                <p>{description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
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

const DESCRIPTIONS = {
  grossEarnings:
    'Your total earnings before any deductions. Includes salary, bonuses, RSU vesting, and other compensation.',
  taxes:
    'Mandatory tax withholdings including Federal Income Tax, State Income Tax, Social Security, and Medicare.',
  deductions:
    'Voluntary deductions from your paycheck including 401(k) contributions, health insurance premiums, FSA, and other pre-tax or post-tax deductions.',
  employerBenefits:
    'Benefits your employer pays on your behalf. These don\'t reduce your paycheck but represent additional compensation value.',
  netPay:
    'Your take-home pay after all taxes and deductions. This is the amount deposited to your bank account.',
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
    <TooltipProvider delayDuration={300}>
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
            description={DESCRIPTIONS.grossEarnings}
          />
          <SummaryCard
            title="Taxes"
            amount={totalTaxes}
            icon={TrendingDown}
            colorClass="text-red-500"
            isNegative
            description={DESCRIPTIONS.taxes}
          />
          <SummaryCard
            title="Deductions"
            amount={totalDeductions}
            icon={Minus}
            colorClass="text-red-500"
            isNegative
            description={DESCRIPTIONS.deductions}
          />
          <SummaryCard
            title="Employer Benefits"
            amount={employerBenefits}
            icon={Building2}
            colorClass="text-green-500"
            description={DESCRIPTIONS.employerBenefits}
          />
          <SummaryCard
            title="Net Pay"
            amount={netPay}
            icon={Wallet}
            colorClass="text-primary"
            description={DESCRIPTIONS.netPay}
          />
        </div>
      </div>
    </TooltipProvider>
  )
}
