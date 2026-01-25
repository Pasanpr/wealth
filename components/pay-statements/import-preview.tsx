'use client'

import { useState } from 'react'
import { ParsedPayStatement } from '@/lib/types'
import { ValidationResult, ValidationIssue } from '@/lib/services/pdf/pay-statement-validator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Check, AlertCircle, AlertTriangle, X, ChevronDown, ChevronRight, Bug } from 'lucide-react'

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
  // Parse YYYY-MM-DD as local date (not UTC) to avoid timezone shift
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ValidationWarnings({ validation }: { validation?: ValidationResult }) {
  if (!validation || validation.issues.length === 0) return null

  const errors = validation.issues.filter(i => i.severity === 'error')
  const warnings = validation.issues.filter(i => i.severity === 'warning')

  return (
    <div className="space-y-2">
      {errors.length > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-red-500 font-medium mb-2">
            <AlertCircle className="h-4 w-4" />
            Validation Errors ({errors.length})
          </div>
          <ul className="space-y-1 text-sm text-red-400">
            {errors.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>
                  {issue.message}
                  {issue.expected !== undefined && issue.actual !== undefined && (
                    <span className="text-red-500/70">
                      {' '}(expected: ${issue.expected.toFixed(2)}, got: ${issue.actual.toFixed(2)})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-500 font-medium mb-2">
            <AlertTriangle className="h-4 w-4" />
            Validation Warnings ({warnings.length})
          </div>
          <ul className="space-y-1 text-sm text-yellow-400">
            {warnings.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span>
                  {issue.message}
                  {issue.expected !== undefined && issue.actual !== undefined && (
                    <span className="text-yellow-500/70">
                      {' '}(expected: ${issue.expected.toFixed(2)}, got: ${issue.actual.toFixed(2)})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
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
  const [expandedDebug, setExpandedDebug] = useState<Set<number>>(new Set())

  const toggleDebug = (index: number) => {
    setExpandedDebug(prev => {
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

  const hasValidationErrors = items.some(item => item.validation && !item.validation.isValid)
  const hasValidationWarnings = items.some(
    item => item.validation && item.validation.issues.length > 0
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasValidationErrors ? (
              <>
                <AlertCircle className="h-5 w-5 text-red-500" />
                Preview: {items.length} statement{items.length !== 1 ? 's' : ''} parsed (validation errors found)
              </>
            ) : hasValidationWarnings ? (
              <>
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Preview: {items.length} statement{items.length !== 1 ? 's' : ''} ready to import (with warnings)
              </>
            ) : (
              <>
                <Check className="h-5 w-5 text-green-500" />
                Preview: {items.length} statement{items.length !== 1 ? 's' : ''} ready to import
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Pay Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Taxes</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.filename}</TableCell>
                  <TableCell>{formatDate(item.data.payDate)}</TableCell>
                  <TableCell>
                    {formatDate(item.data.periodStart)} - {formatDate(item.data.periodEnd)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.data.grossEarnings)}
                  </TableCell>
                  <TableCell className="text-right text-red-500">
                    -{formatCurrency(item.data.totalTaxes)}
                  </TableCell>
                  <TableCell className="text-right text-red-500">
                    -{formatCurrency(item.data.totalDeductions)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.data.netPay)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detailed breakdown for each statement */}
      {items.map((item, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {item.validation && !item.validation.isValid ? (
                <AlertCircle className="h-5 w-5 text-red-500" />
              ) : item.validation && item.validation.issues.length > 0 ? (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ) : (
                <Check className="h-5 w-5 text-green-500" />
              )}
              {item.filename} - {formatDate(item.data.payDate)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Validation Warnings */}
            <ValidationWarnings validation={item.validation} />

            {/* Earnings Table */}
            {item.data.items.filter(i => i.categoryCode === 'earnings').length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Earnings</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-28">Current</TableHead>
                      <TableHead className="text-right w-28">YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.data.items
                      .filter(i => i.categoryCode === 'earnings')
                      .map((lineItem, i) => (
                        <TableRow key={i}>
                          <TableCell>{lineItem.itemName}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(lineItem.currentAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {lineItem.ytdAmount ? formatCurrency(lineItem.ytdAmount) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Gross Pay</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.data.grossEarnings)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Taxes Table */}
            {item.data.items.filter(i => i.categoryCode === 'statutory_tax').length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Taxes</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-28">Current</TableHead>
                      <TableHead className="text-right w-28">YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.data.items
                      .filter(i => i.categoryCode === 'statutory_tax')
                      .map((lineItem, i) => (
                        <TableRow key={i}>
                          <TableCell>{lineItem.itemName}</TableCell>
                          <TableCell className="text-right text-red-500">
                            -{formatCurrency(lineItem.currentAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {lineItem.ytdAmount ? formatCurrency(lineItem.ytdAmount) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total Taxes</TableCell>
                      <TableCell className="text-right text-red-500">
                        -{formatCurrency(item.data.totalTaxes)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Deductions Table (Pre-Tax + Post-Tax combined) */}
            {item.data.items.filter(i => i.categoryCode === 'pretax_deduction' || i.categoryCode === 'posttax_deduction').length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Deductions</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-28">Current</TableHead>
                      <TableHead className="text-right w-28">YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Pre-Tax Deductions */}
                    {item.data.items.filter(i => i.categoryCode === 'pretax_deduction').length > 0 && (
                      <>
                        <TableRow>
                          <TableCell colSpan={3} className="text-xs text-muted-foreground font-medium bg-muted/30">
                            Pre-Tax
                          </TableCell>
                        </TableRow>
                        {item.data.items
                          .filter(i => i.categoryCode === 'pretax_deduction')
                          .map((lineItem, i) => (
                            <TableRow key={`pre-${i}`}>
                              <TableCell className="pl-6">{lineItem.itemName}</TableCell>
                              <TableCell className="text-right text-red-500">
                                -{formatCurrency(lineItem.currentAmount)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {lineItem.ytdAmount ? formatCurrency(lineItem.ytdAmount) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </>
                    )}
                    {/* Post-Tax Deductions */}
                    {item.data.items.filter(i => i.categoryCode === 'posttax_deduction').length > 0 && (
                      <>
                        <TableRow>
                          <TableCell colSpan={3} className="text-xs text-muted-foreground font-medium bg-muted/30">
                            Post-Tax
                          </TableCell>
                        </TableRow>
                        {item.data.items
                          .filter(i => i.categoryCode === 'posttax_deduction')
                          .map((lineItem, i) => (
                            <TableRow key={`post-${i}`}>
                              <TableCell className="pl-6">{lineItem.itemName}</TableCell>
                              <TableCell className="text-right text-red-500">
                                -{formatCurrency(lineItem.currentAmount)}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {lineItem.ytdAmount ? formatCurrency(lineItem.ytdAmount) : '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                      </>
                    )}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total Deductions</TableCell>
                      <TableCell className="text-right text-red-500">
                        -{formatCurrency(item.data.totalDeductions)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Employer Benefits Table */}
            {item.data.items.filter(i => i.categoryCode === 'employer_benefit').length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Employer Benefits</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-28">Current</TableHead>
                      <TableHead className="text-right w-28">YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.data.items
                      .filter(i => i.categoryCode === 'employer_benefit')
                      .map((lineItem, i) => (
                        <TableRow key={i}>
                          <TableCell>{lineItem.itemName}</TableCell>
                          <TableCell className="text-right text-green-500">
                            {formatCurrency(lineItem.currentAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {lineItem.ytdAmount ? formatCurrency(lineItem.ytdAmount) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total Benefits</TableCell>
                      <TableCell className="text-right text-green-500">
                        {formatCurrency(item.data.employerBenefits)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">-</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Adjustments Table */}
            {item.data.items.filter(i => i.categoryCode === 'adjustment').length > 0 && (
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-2">Adjustments</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-28">Current</TableHead>
                      <TableHead className="text-right w-28">YTD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.data.items
                      .filter(i => i.categoryCode === 'adjustment')
                      .map((lineItem, i) => (
                        <TableRow key={i}>
                          <TableCell>{lineItem.itemName}</TableCell>
                          <TableCell className="text-right text-blue-500">
                            +{formatCurrency(lineItem.currentAmount)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {lineItem.ytdAmount ? formatCurrency(lineItem.ytdAmount) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Net Pay & Deposits */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Net Pay Summary */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">Net Pay Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Gross Earnings</span>
                    <span>{formatCurrency(item.data.grossEarnings)}</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Total Taxes</span>
                    <span>-{formatCurrency(item.data.totalTaxes)}</span>
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Total Deductions</span>
                    <span>-{formatCurrency(item.data.totalDeductions)}</span>
                  </div>
                  {item.data.items.filter(i => i.categoryCode === 'adjustment').length > 0 && (
                    <div className="flex justify-between text-blue-500">
                      <span>Adjustments</span>
                      <span>+{formatCurrency(
                        item.data.items
                          .filter(i => i.categoryCode === 'adjustment')
                          .reduce((sum, i) => sum + i.currentAmount, 0)
                      )}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Net Pay</span>
                    <span>{formatCurrency(item.data.netPay)}</span>
                  </div>
                </div>
              </div>

              {/* Direct Deposits */}
              {item.data.deposits.length > 0 && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-3">Direct Deposits</h4>
                  <div className="space-y-2 text-sm">
                    {item.data.deposits.map((deposit, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="capitalize">
                          {deposit.accountType} {i + 1}
                          {deposit.accountLast4 && ` (...${deposit.accountLast4})`}
                        </span>
                        <span>{formatCurrency(deposit.amount)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold pt-2 border-t">
                      <span>Total</span>
                      <span>
                        {formatCurrency(item.data.deposits.reduce((sum, d) => sum + d.amount, 0))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Debug: Raw Text */}
            {item.rawText && (
              <div className="pt-4 border-t">
                <button
                  onClick={() => toggleDebug(index)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  {expandedDebug.has(index) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Bug className="h-4 w-4" />
                  Debug: Raw PDF Text
                </button>
                {expandedDebug.has(index) && (
                  <pre className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                    {item.rawText}
                  </pre>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isImporting}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={isImporting}>
          <Check className="h-4 w-4 mr-2" />
          {isImporting ? 'Importing...' : `Import ${items.length} Statement${items.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  )
}
