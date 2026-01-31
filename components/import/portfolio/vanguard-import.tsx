'use client'

import { useState, useCallback } from 'react'
import {
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { Upload, FileText, Check, AlertCircle, X } from 'lucide-react'

interface VanguardHolding {
  accountNumber: string
  accountType: string
  investmentName: string
  symbol: string
  shares: number
  sharePrice: number
  totalValue: number
}

interface VanguardTransaction {
  accountNumber: string
  accountType: string
  tradeDate: string
  settlementDate: string
  transactionType: string
  transactionDescription: string
  investmentName: string
  symbol: string
  shares: number
  sharePrice: number
  principalAmount: number
  commissionsAndFees: number
  netAmount: number
  accruedInterest: number
}

interface VanguardPreview {
  holdings: VanguardHolding[]
  transactions: VanguardTransaction[]
  accounts: { accountNumber: string; accountType: string; totalValue: number }[]
  summary: {
    totalHoldingsValue: number
    totalAccounts: number
    totalSecurities: number
    transactionCount: number
    dateRange: { earliest: string; latest: string } | null
  }
}

interface ImportResult {
  success: boolean
  results: {
    accountsCreated: number
    securitiesCreated: number
    holdingsImported: number
    transactionsImported?: number
    errors: string[]
  }
}

interface VanguardImportProps {
  onComplete: () => void
}

export function VanguardImport({ onComplete }: VanguardImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<VanguardPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [holdingsDate, setHoldingsDate] = useState(new Date().toISOString().split('T')[0])
  const [importHoldings, setImportHoldings] = useState(true)
  const [importTransactions, setImportTransactions] = useState(true)
  const [activeTab, setActiveTab] = useState<'holdings' | 'transactions'>('holdings')
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
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.csv')) {
      setFile(droppedFile)
      setError(null)
      setPreview(null)
      setImportResult(null)
      parseFile(droppedFile)
    } else {
      setError('Please drop a CSV file')
    }
  }, [])

  const parseFile = async (fileToparse: File) => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', fileToparse)
      formData.append('previewOnly', 'true')

      const response = await fetch('/api/portfolio/import-vanguard', {
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
      formData.append('importHoldings', importHoldings.toString())
      formData.append('importTransactions', importTransactions.toString())
      formData.append('holdingsDate', holdingsDate)

      const response = await fetch('/api/portfolio/import-vanguard', {
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
              <p>Accounts created: <span className="font-medium">{importResult.results.accountsCreated}</span></p>
              <p>Securities created: <span className="font-medium">{importResult.results.securitiesCreated}</span></p>
              <p>Holdings imported: <span className="font-medium">{importResult.results.holdingsImported}</span></p>
              <p>Transactions imported: <span className="font-medium">{importResult.results.transactionsImported}</span></p>
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
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">
            Drag and drop your Vanguard CSV file here, or
          </p>
          <label className="inline-block">
            <Input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" asChild>
              <span>Browse Files</span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-4">
            Export from Vanguard: Portfolio &rarr; Download center &rarr; CSV
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

      {/* Preview */}
      {preview && (
        <>
          {/* Summary */}
          <div className="grid gap-4 md:grid-cols-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-xl font-bold">{formatCurrency(preview.summary.totalHoldingsValue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Accounts</p>
              <p className="text-xl font-bold">{preview.summary.totalAccounts}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Securities</p>
              <p className="text-xl font-bold">{preview.summary.totalSecurities}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-xl font-bold">{preview.summary.transactionCount}</p>
            </div>
          </div>

          {/* Import Options */}
          <div className="grid gap-4 md:grid-cols-3 p-4 border rounded-lg">
            <div>
              <Label htmlFor="holdingsDate">Holdings Date</Label>
              <Input
                id="holdingsDate"
                type="date"
                value={holdingsDate}
                onChange={(e) => setHoldingsDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="importHoldings"
                checked={importHoldings}
                onChange={(e) => setImportHoldings(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="importHoldings">Import Holdings ({preview.holdings.length})</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="importTransactions"
                checked={importTransactions}
                onChange={(e) => setImportTransactions(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="importTransactions">Import Transactions ({preview.transactions.length})</Label>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'holdings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('holdings')}
            >
              Holdings ({preview.holdings.length})
            </Button>
            <Button
              variant={activeTab === 'transactions' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('transactions')}
            >
              Transactions ({preview.transactions.length})
            </Button>
          </div>

          {/* Holdings Table */}
          {activeTab === 'holdings' && (
            <div className="border rounded-lg overflow-hidden">
              {preview.holdings.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No holdings found</p>
              ) : (
                <div className="overflow-x-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.holdings.slice(0, 20).map((holding, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{holding.accountNumber}</TableCell>
                          <TableCell className="font-medium">{holding.symbol}</TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs">{holding.investmentName}</TableCell>
                          <TableCell className="text-right">{formatNumber(holding.shares, 4)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(holding.sharePrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(holding.totalValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {preview.holdings.length > 20 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Showing first 20 of {preview.holdings.length} holdings
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Transactions Table */}
          {activeTab === 'transactions' && (
            <div className="border rounded-lg overflow-hidden">
              {preview.transactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No transactions found</p>
              ) : (
                <div className="overflow-x-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Symbol</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.transactions.slice(0, 20).map((tx, i) => (
                        <TableRow key={i}>
                          <TableCell>{formatDate(tx.tradeDate)}</TableCell>
                          <TableCell className="font-mono text-xs">{tx.accountNumber}</TableCell>
                          <TableCell className="text-xs">{tx.transactionType}</TableCell>
                          <TableCell className="font-medium">{tx.symbol}</TableCell>
                          <TableCell className="text-right">{tx.shares ? formatNumber(tx.shares, 4) : '--'}</TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.netAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {preview.transactions.length > 20 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Showing first 20 of {preview.transactions.length} transactions
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={clearFile}>Cancel</Button>
            <Button onClick={handleImport} disabled={loading || (!importHoldings && !importTransactions)}>
              {loading ? 'Importing...' : 'Import Data'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
