'use client'

import { useState, useCallback } from 'react'
import {
  Button,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { Building2, FileText, Check, AlertCircle, X } from 'lucide-react'

interface Fidelity401kTransaction {
  date: string
  investment: string
  transactionType: string
  amount: number
  shares: number
}

interface Fidelity401kHolding {
  investment: string
  category: string
  shares: number
  price: number
  value: number
  symbol: string
}

interface Preview401kCsv {
  preview: boolean
  fileType: 'csv'
  planName: string
  dateRange: string
  transactionCount: number
  totalContributions: number
  investments: {
    name: string
    symbol: string
    totalAmount: number
    totalShares: number
  }[]
  transactions: Fidelity401kTransaction[]
}

interface Preview401kPdf {
  preview: boolean
  fileType: 'pdf'
  planName: string
  statementPeriod: { start: string; end: string }
  beginningBalance: number
  endingBalance: number
  yourContributions: number
  employerContributions: number
  changeInMarketValue: number
  holdings: Fidelity401kHolding[]
  contributionSummary: {
    employeeDeferral: { periodToDate: number; inceptionToDate: number; balance: number }
    employerMatch: { periodToDate: number; inceptionToDate: number; balance: number }
    rollover: { periodToDate: number; inceptionToDate: number; balance: number }
  } | null
  rawText?: string
}

type Preview401k = Preview401kCsv | Preview401kPdf

interface ImportResult401k {
  success: boolean
  fileType: 'csv' | 'pdf'
  results: {
    accountCreated: boolean
    securitiesCreated: number
    contributionsImported?: number
    holdingsImported?: number
    holdingsUpdated?: number
    errors: string[]
  }
}

interface Fidelity401kImportProps {
  onComplete: () => void
}

export function Fidelity401kImport({ onComplete }: Fidelity401kImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview401k | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult401k | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setPreview(null)
      setImportResult(null)
      parseFile(selectedFile)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    const fileName = droppedFile?.name.toLowerCase() || ''
    if (droppedFile && (fileName.endsWith('.csv') || fileName.endsWith('.pdf'))) {
      setFile(droppedFile)
      setError(null)
      setPreview(null)
      setImportResult(null)
      parseFile(droppedFile)
    } else {
      setError('Please drop a PDF or CSV file')
    }
  }, [])

  const parseFile = async (fileToparse: File) => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', fileToparse)
      formData.append('previewOnly', 'true')

      const response = await fetch('/api/portfolio/import-401k', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse file')
      }

      setPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('previewOnly', 'false')

      const response = await fetch('/api/portfolio/import-401k', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import file')
      }

      setImportResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import file')
    } finally {
      setLoading(false)
    }
  }

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setError(null)
    setImportResult(null)
  }

  // Import complete view
  if (importResult) {
    return (
      <div className="pt-4">
        <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
          <Check className="h-8 w-8 text-green-600" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
            <div className="grid gap-2 text-sm">
              <p>Account created: <span className="font-medium">{importResult.results.accountCreated ? 'Yes' : 'No (existing)'}</span></p>
              <p>Securities created: <span className="font-medium">{importResult.results.securitiesCreated}</span></p>
              {importResult.fileType === 'pdf' && (
                <p>Holdings imported: <span className="font-medium">{importResult.results.holdingsImported}</span></p>
              )}
              {importResult.fileType === 'csv' && (
                <p>Contributions imported: <span className="font-medium">{importResult.results.contributionsImported}</span></p>
              )}
            </div>
            {importResult.results.errors.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-500/10 rounded-md">
                <p className="font-medium text-yellow-600 mb-1">Warnings:</p>
                <ul className="text-sm text-muted-foreground">
                  {importResult.results.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={onComplete}>Done</Button>
              <Button variant="outline" onClick={clearFile}>Import Another</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      {/* File Upload */}
      {!preview && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">
            Drag and drop your Fidelity 401(k) PDF statement or CSV here, or
          </p>
          <label className="inline-block">
            <Input
              type="file"
              accept=".pdf,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" asChild>
              <span>Browse Files</span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-4">
            PDF: Statement with holdings | CSV: Transaction history
          </p>
        </div>
      )}

      {/* File Selected */}
      {file && !preview && !loading && (
        <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
          <FileText className="h-8 w-8 text-primary" />
          <div className="flex-1">
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFile}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p>Parsing file...</p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md flex items-start gap-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Preview - PDF Format */}
      {preview && preview.fileType === 'pdf' && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Plan Name</p>
              <p className="text-lg font-bold">{preview.planName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Statement Date</p>
              <p className="text-lg font-bold">{formatDate(preview.statementPeriod.end)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Beginning Balance</p>
              <p className="text-xl font-bold">{formatCurrency(preview.beginningBalance)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ending Balance</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(preview.endingBalance)}</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3 p-4 border rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Your Contributions</p>
              <p className="text-lg font-medium">{formatCurrency(preview.yourContributions)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Employer Contributions</p>
              <p className="text-lg font-medium">{formatCurrency(preview.employerContributions)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Change in Market Value</p>
              <p className={`text-lg font-medium ${preview.changeInMarketValue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {preview.changeInMarketValue >= 0 ? '+' : ''}{formatCurrency(preview.changeInMarketValue)}
              </p>
            </div>
          </div>

          {/* Holdings Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <h3 className="font-medium">Holdings ({preview.holdings.length})</h3>
            </div>
            {preview.holdings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No holdings found in PDF</p>
            ) : (
              <div className="overflow-x-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Investment</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Shares</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.holdings.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-xs max-w-[200px] truncate">{h.investment}</TableCell>
                        <TableCell className="font-mono">{h.symbol}</TableCell>
                        <TableCell className="text-xs">{h.category}</TableCell>
                        <TableCell className="text-right">{formatNumber(h.shares, 4)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(h.price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(h.value)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={clearFile}>Cancel</Button>
            <Button onClick={handleImport} disabled={loading || preview.holdings.length === 0}>
              {loading ? 'Importing...' : 'Import Holdings'}
            </Button>
          </div>
        </>
      )}

      {/* Preview - CSV Format */}
      {preview && preview.fileType === 'csv' && (
        <>
          <div className="grid gap-4 md:grid-cols-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Plan Name</p>
              <p className="text-lg font-bold">{preview.planName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Range</p>
              <p className="text-lg font-bold">{preview.dateRange}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-xl font-bold">{preview.transactionCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contributions</p>
              <p className="text-xl font-bold">{formatCurrency(preview.totalContributions)}</p>
            </div>
          </div>

          {/* Investment Breakdown */}
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <h3 className="font-medium">Investment Breakdown</h3>
            </div>
            <div className="overflow-x-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investment</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Total Shares</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.investments.map((inv, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-xs max-w-[200px] truncate">{inv.name}</TableCell>
                      <TableCell className="font-mono">{inv.symbol}</TableCell>
                      <TableCell className="text-right">{formatCurrency(inv.totalAmount)}</TableCell>
                      <TableCell className="text-right">{formatNumber(inv.totalShares, 4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <h3 className="font-medium">Transactions Preview</h3>
            </div>
            <div className="overflow-x-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Investment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.transactions.slice(0, 15).map((tx, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDate(tx.date)}</TableCell>
                      <TableCell className="font-medium text-xs max-w-[150px] truncate">{tx.investment}</TableCell>
                      <TableCell className="text-xs">{tx.transactionType}</TableCell>
                      <TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell>
                      <TableCell className="text-right">{formatNumber(tx.shares, 4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.transactions.length > 15 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Showing first 15 of {preview.transactions.length} transactions
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={clearFile}>Cancel</Button>
            <Button onClick={handleImport} disabled={loading}>
              {loading ? 'Importing...' : 'Import Contributions'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
