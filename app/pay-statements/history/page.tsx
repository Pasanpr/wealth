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
import { StatementList } from '@/components/pay-statements/statement-list'
import { PayStatement } from '@/lib/types'
import { Upload } from 'lucide-react'

export default function PayStatementsHistoryPage() {
  const [statements, setStatements] = useState<PayStatement[]>([])
  const [years, setYears] = useState<number[]>([])
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  const fetchStatements = async () => {
    try {
      setLoading(true)
      const url =
        selectedYear === 'all'
          ? '/api/pay-statements'
          : `/api/pay-statements?year=${selectedYear}`
      const res = await fetch(url)
      const data = await res.json()
      setStatements(data.statements || [])
      setYears(data.years || [])
    } catch (error) {
      console.error('Failed to fetch statements:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatements()
  }, [selectedYear])

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this pay statement?')) return

    try {
      await fetch(`/api/pay-statements/${id}`, { method: 'DELETE' })
      fetchStatements()
    } catch (error) {
      console.error('Failed to delete statement:', error)
    }
  }

  return (
    <PageContainer
      title="Pay Statement History"
      description="View all imported pay statements"
      actions={
        <Button asChild>
          <Link href="/import">
            <Upload className="mr-2 h-4 w-4" />
            Import PDFs
          </Link>
        </Button>
      }
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>All Statements</CardTitle>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Filter by year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map(year => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <StatementList statements={statements} onDelete={handleDelete} />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  )
}
