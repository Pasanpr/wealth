'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { PaySummary } from '@/components/pay-statements/pay-summary'
import { StatementList } from '@/components/pay-statements/statement-list'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { PayStatement, YtdPaySummary } from '@/lib/types'
import { Upload, FileText, History } from 'lucide-react'

export default function PayStatementsPage() {
  const [statements, setStatements] = useState<PayStatement[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('')
  const [ytdSummary, setYtdSummary] = useState<YtdPaySummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      setLoading(true)
      const year = selectedYear || undefined
      const [statementsRes, ytdRes] = await Promise.all([
        fetch(year ? `/api/pay-statements?year=${year}` : '/api/pay-statements'),
        fetch(year ? `/api/pay-statements/ytd?year=${year}` : '/api/pay-statements/ytd'),
      ])

      const statementsData = await statementsRes.json()
      const ytdData = await ytdRes.json()

      setStatements(statementsData.statements || [])
      setYears(statementsData.years || [])
      setYtdSummary(ytdData)

      // Set default year if not set
      if (!selectedYear && statementsData.years?.length > 0) {
        setSelectedYear(String(statementsData.years[0]))
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this pay statement?')) return

    try {
      await fetch(`/api/pay-statements/${id}`, { method: 'DELETE' })
      fetchData()
    } catch (error) {
      console.error('Failed to delete statement:', error)
    }
  }

  const recentStatements = statements.slice(0, 5)

  return (
    <PageContainer
      title="Pay Statements"
      description="Track earnings, taxes, deductions, and employer benefits"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/pay-statements/history">
              <History className="mr-2 h-4 w-4" />
              History
            </Link>
          </Button>
          <Button asChild>
            <Link href="/pay-statements/import">
              <Upload className="mr-2 h-4 w-4" />
              Import PDFs
            </Link>
          </Button>
        </div>
      }
    >
      {/* Year Filter */}
      {years.length > 0 && (
        <div className="mb-6">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : statements.length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Pay Statements</h3>
              <p className="text-muted-foreground mb-4">
                Import your ADP pay stubs to start tracking earnings
              </p>
              <Button asChild>
                <Link href="/pay-statements/import">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Pay Stubs
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* YTD Summary */}
          {ytdSummary && (
            <PaySummary
              title={`${ytdSummary.year} Year-to-Date`}
              subtitle={`As of ${formatDate(ytdSummary.asOfDate)} (${ytdSummary.statementCount} statements)`}
              grossEarnings={ytdSummary.grossEarnings}
              totalTaxes={ytdSummary.totalTaxes}
              totalDeductions={ytdSummary.totalDeductions}
              employerBenefits={ytdSummary.employerBenefits}
              netPay={ytdSummary.netPay}
            />
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Effective Tax Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {ytdSummary && ytdSummary.grossEarnings > 0
                    ? `${((ytdSummary.totalTaxes / ytdSummary.grossEarnings) * 100).toFixed(1)}%`
                    : '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Savings Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {ytdSummary && ytdSummary.grossEarnings > 0
                    ? `${((ytdSummary.totalDeductions / ytdSummary.grossEarnings) * 100).toFixed(1)}%`
                    : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Pre-tax + Post-tax deductions</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Take-Home Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {ytdSummary && ytdSummary.grossEarnings > 0
                    ? `${((ytdSummary.netPay / ytdSummary.grossEarnings) * 100).toFixed(1)}%`
                    : '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Statements */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Statements</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/pay-statements/history">View All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <StatementList statements={recentStatements} onDelete={handleDelete} />
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  )
}
