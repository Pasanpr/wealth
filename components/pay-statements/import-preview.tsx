'use client'

import { useState } from 'react'
import { ParsedPayStatement } from '@/lib/types'
import { ValidationResult } from '@/lib/services/pdf/pay-statement-validator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Check,
  AlertCircle,
  AlertTriangle,
  X,
  ChevronDown,
  ChevronRight,
  Copy,
  CheckCheck,
} from 'lucide-react'

interface PreviewItem {
  filename: string
  data: ParsedPayStatement
  fileHash: string
  rawText?: string
  validation?: ValidationResult
}

interface ImportPreviewProps {
  items: PreviewItem[]
  onConfirm: () => void
  onCancel: () => void
  isImporting?: boolean
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function StatementRow({ item, isExpanded, onToggle }: {
  item: PreviewItem
  isExpanded: boolean
  onToggle: () => void
}) {
  const [copied, setCopied] = useState<'raw' | 'issues' | null>(null)

  const hasErrors = item.validation && !item.validation.isValid
  const hasWarnings = item.validation && item.validation.issues.length > 0 && item.validation.isValid
  const errors = item.validation?.issues.filter(i => i.severity === 'error') || []
  const warnings = item.validation?.issues.filter(i => i.severity === 'warning') || []
  const allIssues = [...errors, ...warnings]

  const copyRawText = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!item.rawText) return

    await navigator.clipboard.writeText(item.rawText)
    setCopied('raw')
    setTimeout(() => setCopied(null), 2000)
  }

  const copyIssues = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (allIssues.length === 0) return

    const text = allIssues.map(issue => {
      let line = `[${issue.severity.toUpperCase()}] ${issue.message}`
      if (issue.expected !== undefined && issue.actual !== undefined) {
        line += ` (expected: $${issue.expected.toFixed(2)}, got: $${issue.actual.toFixed(2)})`
      }
      return line
    }).join('\n')

    await navigator.clipboard.writeText(`${item.filename}\n${'='.repeat(item.filename.length)}\n${text}`)
    setCopied('issues')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Main row - always visible */}
      <div
        onClick={onToggle}
        className="px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        {/* Expand icon */}
        <div className="shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </div>

        {/* Status icon */}
        <div className="shrink-0">
          {hasErrors ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : hasWarnings ? (
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          ) : (
            <Check className="h-4 w-4 text-green-500" />
          )}
        </div>

        {/* Filename */}
        <span className="flex-1 truncate text-sm font-medium">
          {item.filename}
        </span>

        {/* Pay date */}
        <span className="shrink-0 text-sm text-muted-foreground w-20">
          {formatDate(item.data.payDate)}
        </span>

        {/* Net pay */}
        <span className="shrink-0 text-sm font-medium w-24 text-right">
          {formatCurrency(item.data.netPay)}
        </span>

        {/* Copy issues button */}
        {allIssues.length > 0 && (
          <button
            onClick={copyIssues}
            className="shrink-0 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={`Copy ${allIssues.length} issue${allIssues.length !== 1 ? 's' : ''}`}
          >
            {copied === 'issues' ? (
              <CheckCheck className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Copy LLM data button */}
        {item.rawText && (
          <button
            onClick={copyRawText}
            className="shrink-0 p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Copy LLM extracted data"
          >
            {copied === 'raw' ? (
              <CheckCheck className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t bg-muted/30 space-y-3">
          {/* Validation issues */}
          {errors.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Errors
              </div>
              <ul className="text-xs text-red-400 space-y-0.5">
                {errors.map((issue, i) => (
                  <li key={i}>
                    {issue.message}
                    {issue.expected !== undefined && issue.actual !== undefined && (
                      <span className="text-red-500/70">
                        {' '}(expected: ${issue.expected.toFixed(2)}, got: ${issue.actual.toFixed(2)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <div className="flex items-center gap-2 text-yellow-500 text-sm font-medium mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                Warnings
              </div>
              <ul className="text-xs text-yellow-400 space-y-0.5">
                {warnings.map((issue, i) => (
                  <li key={i}>
                    {issue.message}
                    {issue.expected !== undefined && issue.actual !== undefined && (
                      <span className="text-yellow-500/70">
                        {' '}(expected: ${issue.expected.toFixed(2)}, got: ${issue.actual.toFixed(2)})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Period</div>
              <div>{formatDate(item.data.periodStart)} - {formatDate(item.data.periodEnd)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Gross</div>
              <div>{formatCurrency(item.data.grossEarnings)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Taxes</div>
              <div className="text-red-500">-{formatCurrency(item.data.totalTaxes)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Deductions</div>
              <div className="text-red-500">-{formatCurrency(item.data.totalDeductions)}</div>
            </div>
          </div>

          {/* Direct deposits */}
          {item.data.deposits.length > 0 && (
            <div className="text-sm">
              <div className="text-xs text-muted-foreground mb-1">Deposits</div>
              <div className="flex flex-wrap gap-2">
                {item.data.deposits.map((deposit, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs">
                    <span className="capitalize">{deposit.accountType}</span>
                    {deposit.accountLast4 && <span className="text-muted-foreground">...{deposit.accountLast4}</span>}
                    <span className="font-medium">{formatCurrency(deposit.amount)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* LLM output for debugging */}
          {item.rawText && (
            <div className="text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">LLM Extracted Data</span>
                <button
                  onClick={copyRawText}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied === 'raw' ? (
                    <>
                      <CheckCheck className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                {item.rawText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ImportPreview({
  items,
  onConfirm,
  onCancel,
  isImporting,
}: ImportPreviewProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())

  const toggleItem = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col items-center text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No valid pay statements found</p>
            <p className="text-sm text-muted-foreground">
              Please check that your PDFs are ADP pay stubs
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const errorCount = items.filter(item => item.validation && !item.validation.isValid).length
  const warningCount = items.filter(
    item => item.validation && item.validation.isValid && item.validation.issues.length > 0
  ).length
  const validCount = items.length - errorCount - warningCount

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {items.length} statement{items.length !== 1 ? 's' : ''} to import
            </CardTitle>
            <div className="flex items-center gap-3 text-sm">
              {validCount > 0 && (
                <span className="flex items-center gap-1 text-green-500">
                  <Check className="h-4 w-4" />
                  {validCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="flex items-center gap-1 text-yellow-500">
                  <AlertTriangle className="h-4 w-4" />
                  {warningCount}
                </span>
              )}
              {errorCount > 0 && (
                <span className="flex items-center gap-1 text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  {errorCount}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item, index) => (
            <StatementRow
              key={index}
              item={item}
              isExpanded={expandedItems.has(index)}
              onToggle={() => toggleItem(index)}
            />
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={isImporting}>
          <Check className="h-4 w-4 mr-2" />
          {isImporting ? 'Importing...' : `Import ${items.length}`}
        </Button>
      </div>
    </div>
  )
}
