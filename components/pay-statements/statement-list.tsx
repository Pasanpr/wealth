'use client'

import Link from 'next/link'
import { PayStatement } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Eye, Trash2 } from 'lucide-react'

interface StatementListProps {
  statements: PayStatement[]
  onDelete?: (id: number) => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDate(dateStr: string): string {
  // Parse YYYY-MM-DD as local date (not UTC) to avoid timezone shift
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function StatementList({ statements, onDelete }: StatementListProps) {
  if (statements.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pay statements found
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Pay Date</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Gross</TableHead>
          <TableHead className="text-right">Taxes</TableHead>
          <TableHead className="text-right">Deductions</TableHead>
          <TableHead className="text-right">Net Pay</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statements.map(statement => (
          <TableRow key={statement.id}>
            <TableCell className="font-medium">
              {formatDate(statement.pay_date)}
            </TableCell>
            <TableCell>
              {formatDate(statement.period_start)} - {formatDate(statement.period_end)}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted">
                {statement.source_type.toUpperCase()}
              </span>
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(statement.gross_earnings)}
            </TableCell>
            <TableCell className="text-right text-red-500">
              -{formatCurrency(statement.total_taxes)}
            </TableCell>
            <TableCell className="text-right text-red-500">
              -{formatCurrency(statement.total_deductions)}
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatCurrency(statement.net_pay)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/pay-statements/${statement.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(statement.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
