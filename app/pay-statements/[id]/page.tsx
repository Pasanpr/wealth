'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { PaySummary } from '@/components/pay-statements/pay-summary'
import { PayItemsTable } from '@/components/pay-statements/pay-items-table'
import { PayStatementWithItems } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { ArrowLeft, Trash2, Calendar, FileText, Bug } from 'lucide-react'

export default function PayStatementDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isDebugMode = searchParams.has('debug')
  const [statement, setStatement] = useState<PayStatementWithItems | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatement = async () => {
      try {
        const res = await fetch(`/api/pay-statements/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setStatement(data)
        }
      } catch (error) {
        console.error('Failed to fetch statement:', error)
      } finally {
        setLoading(false)
      }
    }

    if (params.id) {
      fetchStatement()
    }
  }, [params.id])

  const handleDelete = async () => {
    if (!statement) return
    if (!confirm('Are you sure you want to delete this pay statement?')) return

    try {
      await fetch(`/api/pay-statements/${statement.id}`, { method: 'DELETE' })
      router.push('/pay-statements')
    } catch (error) {
      console.error('Failed to delete statement:', error)
    }
  }

  if (loading) {
    return (
      <PageContainer title="Pay Statement">
        <div className="text-muted-foreground">Loading...</div>
      </PageContainer>
    )
  }

  if (!statement) {
    return (
      <PageContainer title="Pay Statement">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Pay statement not found</p>
            <Button className="mt-4" asChild>
              <Link href="/pay-statements">Back to Pay Statements</Link>
            </Button>
          </CardContent>
        </Card>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      title={`Pay Statement - ${formatDate(statement.pay_date)}`}
      description={`Pay period: ${formatDate(statement.period_start)} - ${formatDate(statement.period_end)}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/pay-statements">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <Button
            variant={isDebugMode ? 'default' : 'outline'}
            onClick={() => {
              const url = new URL(window.location.href)
              if (isDebugMode) {
                url.searchParams.delete('debug')
              } else {
                url.searchParams.set('debug', '1')
              }
              router.push(url.pathname + url.search)
            }}
            className={isDebugMode ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
          >
            <Bug className="mr-2 h-4 w-4" />
            Debug
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      }
    >
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Pay Date</p>
                <p className="font-medium">{formatDate(statement.pay_date)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Pay Period</p>
                <p className="font-medium">
                  {formatDate(statement.period_start)} - {formatDate(statement.period_end)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="font-medium capitalize">{statement.source_type}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Totals */}
      <PaySummary
        grossEarnings={statement.gross_earnings}
        totalTaxes={statement.total_taxes}
        totalDeductions={statement.total_deductions}
        employerBenefits={statement.employer_benefits}
        netPay={statement.net_pay}
      />

      {/* Line Items by Category */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-4">Breakdown</h2>
        <PayItemsTable items={statement.items} showYtd />
      </div>

      {/* Direct Deposits */}
      {statement.deposits.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Direct Deposits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {statement.deposits.map(deposit => (
                <div
                  key={deposit.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <span className="capitalize">
                    {deposit.account_type}
                    {deposit.account_last4 && ` (...${deposit.account_last4})`}
                  </span>
                  <span className="font-medium">{formatCurrency(deposit.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* YTD Totals */}
      {(statement.ytd_gross_earnings || statement.ytd_net_pay) && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Year-to-Date Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statement.ytd_gross_earnings && (
                <div>
                  <p className="text-sm text-muted-foreground">YTD Gross</p>
                  <p className="text-lg font-medium">
                    {formatCurrency(statement.ytd_gross_earnings)}
                  </p>
                </div>
              )}
              {statement.ytd_total_taxes && (
                <div>
                  <p className="text-sm text-muted-foreground">YTD Taxes</p>
                  <p className="text-lg font-medium text-red-500">
                    -{formatCurrency(statement.ytd_total_taxes)}
                  </p>
                </div>
              )}
              {statement.ytd_total_deductions && (
                <div>
                  <p className="text-sm text-muted-foreground">YTD Deductions</p>
                  <p className="text-lg font-medium text-red-500">
                    -{formatCurrency(statement.ytd_total_deductions)}
                  </p>
                </div>
              )}
              {statement.ytd_net_pay && (
                <div>
                  <p className="text-sm text-muted-foreground">YTD Net Pay</p>
                  <p className="text-lg font-medium">
                    {formatCurrency(statement.ytd_net_pay)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Mode Section */}
      {isDebugMode && <DebugSection statement={statement} />}
    </PageContainer>
  )
}

function DebugSection({ statement }: { statement: PayStatementWithItems }) {
  // Calculate totals from items
  const earningsItems = statement.items.filter(i => i.category_code === 'earnings')
  const taxItems = statement.items.filter(i => i.category_code === 'statutory_tax')
  const pretaxItems = statement.items.filter(i => i.category_code === 'pretax_deduction')
  const posttaxItems = statement.items.filter(i => i.category_code === 'posttax_deduction')
  const benefitItems = statement.items.filter(i => i.category_code === 'employer_benefit')
  const adjustmentItems = statement.items.filter(i => i.category_code === 'adjustment')

  const calcEarnings = earningsItems.reduce((s, i) => s + i.current_amount, 0)
  const calcTaxes = taxItems.reduce((s, i) => s + i.current_amount, 0)
  const calcPretax = pretaxItems.reduce((s, i) => s + i.current_amount, 0)
  const calcPosttax = posttaxItems.reduce((s, i) => s + i.current_amount, 0)
  const calcDeductions = calcPretax + calcPosttax
  const calcBenefits = benefitItems.reduce((s, i) => s + i.current_amount, 0)
  const calcAdjustments = adjustmentItems.reduce((s, i) => s + i.current_amount, 0)
  const calcNetPay = calcEarnings - calcTaxes - calcDeductions + calcAdjustments

  const depositsTotal = statement.deposits.reduce((s, d) => s + d.amount, 0)

  const isRsuStub = statement.period_start === statement.period_end &&
    earningsItems.some(i => i.item_code === 'RSU_VEST' && i.current_amount > 0) &&
    statement.net_pay === 0

  return (
    <div className="mt-8 space-y-6 border-t-4 border-yellow-500 pt-6">
      <div className="flex items-center gap-2 text-yellow-600">
        <Bug className="h-5 w-5" />
        <h2 className="text-lg font-bold">Debug Mode</h2>
      </div>

      {/* Statement Type */}
      <Card className={isRsuStub ? 'border-purple-500' : ''}>
        <CardHeader>
          <CardTitle className="text-base">Statement Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isRsuStub ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
            }`}>
              {isRsuStub ? 'RSU Vesting Stub' : 'Regular Paycheck'}
            </span>
            <span className="text-sm text-muted-foreground">
              ID: {statement.id} | Hash: {statement.source_file_hash?.slice(0, 12)}...
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Stored vs Calculated Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stored vs Calculated Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Field</th>
                <th className="text-right py-2">Stored</th>
                <th className="text-right py-2">Calculated</th>
                <th className="text-right py-2">Diff</th>
              </tr>
            </thead>
            <tbody>
              <DebugRow label="Gross Earnings" stored={statement.gross_earnings} calculated={calcEarnings} />
              <DebugRow label="Total Taxes" stored={statement.total_taxes} calculated={calcTaxes} />
              <DebugRow label="Total Deductions" stored={statement.total_deductions} calculated={calcDeductions} />
              <DebugRow label="- Pre-tax" stored={null} calculated={calcPretax} indent />
              <DebugRow label="- Post-tax" stored={null} calculated={calcPosttax} indent />
              <DebugRow label="Employer Benefits" stored={statement.employer_benefits} calculated={calcBenefits} />
              <DebugRow label="Adjustments" stored={null} calculated={calcAdjustments} />
              <tr className="border-t-2 font-medium">
                <td className="py-2">Net Pay</td>
                <td className="text-right">{formatCurrency(statement.net_pay)}</td>
                <td className="text-right">{formatCurrency(calcNetPay)}</td>
                <td className={`text-right ${Math.abs(statement.net_pay - calcNetPay) > 0.02 ? 'text-yellow-600 font-bold' : 'text-green-600'}`}>
                  {formatCurrency(statement.net_pay - calcNetPay)}
                </td>
              </tr>
              <tr className="border-t">
                <td className="py-2">Deposits Total</td>
                <td className="text-right text-muted-foreground">-</td>
                <td className="text-right">{formatCurrency(depositsTotal)}</td>
                <td className={`text-right ${Math.abs(statement.net_pay - depositsTotal) > 0.02 && !isRsuStub ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                  vs net: {formatCurrency(statement.net_pay - depositsTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Items by Category */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Items by Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ItemCategoryTable title="Earnings" items={earningsItems} color="green" />
          <ItemCategoryTable title="Statutory Taxes" items={taxItems} color="red" />
          <ItemCategoryTable title="Pre-tax Deductions" items={pretaxItems} color="orange" />
          <ItemCategoryTable title="Post-tax Deductions" items={posttaxItems} color="orange" />
          <ItemCategoryTable title="Adjustments" items={adjustmentItems} color="blue" />
          <ItemCategoryTable title="Employer Benefits" items={benefitItems} color="purple" />
        </CardContent>
      </Card>

      {/* Raw JSON */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raw Statement Data</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs overflow-auto max-h-96 p-4 bg-muted rounded font-mono">
            {JSON.stringify(statement, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

function DebugRow({
  label,
  stored,
  calculated,
  indent = false,
}: {
  label: string
  stored: number | null
  calculated: number
  indent?: boolean
}) {
  const diff = stored !== null ? stored - calculated : null
  const hasDiff = diff !== null && Math.abs(diff) > 0.02

  return (
    <tr className={indent ? 'text-muted-foreground' : ''}>
      <td className={`py-1 ${indent ? 'pl-4' : ''}`}>{label}</td>
      <td className="text-right">{stored !== null ? formatCurrency(stored) : '-'}</td>
      <td className="text-right">{formatCurrency(calculated)}</td>
      <td className={`text-right ${hasDiff ? 'text-yellow-600 font-medium' : 'text-green-600'}`}>
        {diff !== null ? formatCurrency(diff) : '-'}
      </td>
    </tr>
  )
}

function ItemCategoryTable({
  title,
  items,
  color,
}: {
  title: string
  items: PayStatementWithItems['items']
  color: string
}) {
  if (items.length === 0) return null

  const total = items.reduce((s, i) => s + i.current_amount, 0)
  const colorClasses: Record<string, string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    orange: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    purple: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorClasses[color]}`}>
          {title} ({items.length})
        </span>
        <span className="text-sm font-medium">{formatCurrency(total)}</span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-1">Code</th>
            <th className="text-left py-1">Name</th>
            <th className="text-right py-1">Current</th>
            <th className="text-right py-1">YTD</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-dashed">
              <td className="py-1 font-mono">{item.item_code}</td>
              <td className="py-1">{item.item_name}</td>
              <td className="text-right">{formatCurrency(item.current_amount)}</td>
              <td className="text-right text-muted-foreground">
                {item.ytd_amount ? formatCurrency(item.ytd_amount) : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
