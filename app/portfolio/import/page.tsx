'use client'

import { useState, useCallback } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Input,
  Label,
} from '@/components/ui'
import { formatCurrency, formatNumber } from '@/lib/utils/format'
import { Upload, FileText, Check, AlertCircle, X, GraduationCap } from 'lucide-react'
import Link from 'next/link'

// Vanguard CSV types
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

// 529 PDF types
interface Vanguard529Account {
  accountNumber: string
  beneficiaryName: string
  portfolioName: string
  units: number
  unitValue: number
  totalValue: number
  principal: number
  earnings: number
  ytdContributions: number
  assetMix: {
    stocks: number
    fixedIncome: number
    shortTerm: number
  }
}

interface Vanguard529Contribution {
  accountNumber: string
  tradeDate: string
  portfolioName: string
  transactionType: string
  amount: number
  unitsTransacted: number
  unitValue: number
}

interface Preview529 {
  preview: boolean
  statementDate: string
  totalValue: number
  accounts: Vanguard529Account[]
  contributions: Vanguard529Contribution[]
  summary: {
    accountCount: number
    totalValue: number
    contributionCount: number
    totalContributions: number
  }
}

interface ImportResult {
  success: boolean
  results: {
    accountsCreated: number
    securitiesCreated: number
    holdingsImported: number
    transactionsImported?: number
    contributionsImported?: number
    errors: string[]
  }
}

type ImportType = 'vanguard-csv' | '529-pdf'

export default function PortfolioImportPage() {
  const [importType, setImportType] = useState<ImportType>('vanguard-csv')

  // Vanguard CSV state
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

  // 529 PDF state
  const [file529, setFile529] = useState<File | null>(null)
  const [preview529, setPreview529] = useState<Preview529 | null>(null)
  const [loading529, setLoading529] = useState(false)
  const [error529, setError529] = useState<string | null>(null)
  const [importResult529, setImportResult529] = useState<ImportResult | null>(null)
  const [importHoldings529, setImportHoldings529] = useState(true)
  const [importContributions529, setImportContributions529] = useState(true)
  const [isDragOver529, setIsDragOver529] = useState(false)
  const [active529Tab, setActive529Tab] = useState<'accounts' | 'contributions'>('accounts')

  // Vanguard CSV handlers
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

  // 529 PDF handlers
  const handleFile529Select = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile529(selectedFile)
      setError529(null)
      setPreview529(null)
      setImportResult529(null)
      parseFile529(selectedFile)
    }
  }

  const handleDragOver529 = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver529(true)
  }, [])

  const handleDragLeave529 = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver529(false)
  }, [])

  const handleDrop529 = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver529(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.pdf')) {
      setFile529(droppedFile)
      setError529(null)
      setPreview529(null)
      setImportResult529(null)
      parseFile529(droppedFile)
    } else {
      setError529('Please drop a PDF file')
    }
  }, [])

  const parseFile529 = async (fileToparse: File) => {
    setLoading529(true)
    setError529(null)

    try {
      const formData = new FormData()
      formData.append('file', fileToparse)
      formData.append('previewOnly', 'true')

      const response = await fetch('/api/portfolio/import-529', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse PDF')
      }

      setPreview529(data)
    } catch (err) {
      setError529(err instanceof Error ? err.message : 'Failed to parse PDF')
    } finally {
      setLoading529(false)
    }
  }

  const handleImport529 = async () => {
    if (!file529) return

    setLoading529(true)
    setError529(null)

    try {
      const formData = new FormData()
      formData.append('file', file529)
      formData.append('previewOnly', 'false')
      formData.append('importHoldings', importHoldings529.toString())
      formData.append('importContributions', importContributions529.toString())

      const response = await fetch('/api/portfolio/import-529', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to import PDF')
      }

      setImportResult529(data)
    } catch (err) {
      setError529(err instanceof Error ? err.message : 'Failed to import PDF')
    } finally {
      setLoading529(false)
    }
  }

  const clearFile529 = () => {
    setFile529(null)
    setPreview529(null)
    setError529(null)
    setImportResult529(null)
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <PageContainer
      title="Import Portfolio Data"
      description="Import holdings and transactions from Vanguard exports"
      actions={
        <Link href="/portfolio">
          <Button variant="outline">Back to Portfolio</Button>
        </Link>
      }
    >
      {/* Import Type Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={importType === 'vanguard-csv' ? 'default' : 'outline'}
          onClick={() => setImportType('vanguard-csv')}
          className="flex items-center gap-2"
        >
          <FileText className="h-4 w-4" />
          Vanguard CSV
        </Button>
        <Button
          variant={importType === '529-pdf' ? 'default' : 'outline'}
          onClick={() => setImportType('529-pdf')}
          className="flex items-center gap-2"
        >
          <GraduationCap className="h-4 w-4" />
          529 Statement (PDF)
        </Button>
      </div>

      {/* ============ VANGUARD CSV SECTION ============ */}
      {importType === 'vanguard-csv' && (
        <>
          {/* Import Result */}
          {importResult && (
            <Card className="mb-6 border-green-600">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Check className="h-8 w-8 text-green-600" />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">Import Complete</h3>
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
                          {importResult.results.errors.length > 5 && (
                            <li>...and {importResult.results.errors.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      <Link href="/portfolio/holdings">
                        <Button>View Holdings</Button>
                      </Link>
                      <Button variant="outline" onClick={clearFile}>Import Another</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Upload */}
          {!importResult && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Upload Vanguard CSV</CardTitle>
              </CardHeader>
              <CardContent>
                {!file ? (
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
                ) : (
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {error && (
                  <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {preview && !importResult && (
            <>
              {/* Summary */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Import Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(preview.summary.totalHoldingsValue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accounts</p>
                      <p className="text-2xl font-bold">{preview.summary.totalAccounts}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Securities</p>
                      <p className="text-2xl font-bold">{preview.summary.totalSecurities}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold">{preview.summary.transactionCount}</p>
                    </div>
                  </div>
                  {preview.summary.dateRange && (
                    <p className="text-sm text-muted-foreground mt-4">
                      Transaction history: {formatDate(preview.summary.dateRange.earliest)} - {formatDate(preview.summary.dateRange.latest)}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Import Options */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Import Options</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label htmlFor="holdingsDate">Holdings Date</Label>
                      <Input
                        id="holdingsDate"
                        type="date"
                        value={holdingsDate}
                        onChange={(e) => setHoldingsDate(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Date to use for imported holdings snapshot
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="importHoldings"
                        checked={importHoldings}
                        onChange={(e) => setImportHoldings(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="importHoldings">Import Holdings ({preview.holdings.length})</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="importTransactions"
                        checked={importTransactions}
                        onChange={(e) => setImportTransactions(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="importTransactions">Import Transactions ({preview.transactions.length})</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={activeTab === 'holdings' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('holdings')}
                >
                  Holdings ({preview.holdings.length})
                </Button>
                <Button
                  variant={activeTab === 'transactions' ? 'default' : 'outline'}
                  onClick={() => setActiveTab('transactions')}
                >
                  Transactions ({preview.transactions.length})
                </Button>
              </div>

              {/* Holdings Table */}
              {activeTab === 'holdings' && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Holdings Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {preview.holdings.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No holdings found in file</p>
                    ) : (
                      <div className="overflow-x-auto">
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
                            {preview.holdings.map((holding, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-mono text-sm">{holding.accountNumber}</TableCell>
                                <TableCell className="font-medium">{holding.symbol}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{holding.investmentName}</TableCell>
                                <TableCell className="text-right">{formatNumber(holding.shares, 4)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(holding.sharePrice)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(holding.totalValue)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Transactions Table */}
              {activeTab === 'transactions' && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Transactions Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {preview.transactions.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No transactions found in file</p>
                    ) : (
                      <div className="overflow-x-auto">
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
                            {preview.transactions.slice(0, 50).map((tx, i) => (
                              <TableRow key={i}>
                                <TableCell>{formatDate(tx.tradeDate)}</TableCell>
                                <TableCell className="font-mono text-sm">{tx.accountNumber}</TableCell>
                                <TableCell>{tx.transactionType}</TableCell>
                                <TableCell className="font-medium">{tx.symbol}</TableCell>
                                <TableCell className="text-right">
                                  {tx.shares ? formatNumber(tx.shares, 4) : '--'}
                                </TableCell>
                                <TableCell className="text-right">{formatCurrency(tx.netAmount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {preview.transactions.length > 50 && (
                          <p className="text-sm text-muted-foreground mt-2 text-center">
                            Showing first 50 of {preview.transactions.length} transactions
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Import Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={clearFile}>Cancel</Button>
                <Button onClick={handleImport} disabled={loading || (!importHoldings && !importTransactions)}>
                  {loading ? 'Importing...' : 'Import Data'}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* ============ 529 PDF SECTION ============ */}
      {importType === '529-pdf' && (
        <>
          {/* Import Result */}
          {importResult529 && (
            <Card className="mb-6 border-green-600">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Check className="h-8 w-8 text-green-600" />
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">Import Complete</h3>
                    <div className="grid gap-2 text-sm">
                      <p>Accounts created: <span className="font-medium">{importResult529.results.accountsCreated}</span></p>
                      <p>Securities created: <span className="font-medium">{importResult529.results.securitiesCreated}</span></p>
                      <p>Holdings imported: <span className="font-medium">{importResult529.results.holdingsImported}</span></p>
                      <p>Contributions imported: <span className="font-medium">{importResult529.results.contributionsImported}</span></p>
                    </div>
                    {importResult529.results.errors.length > 0 && (
                      <div className="mt-4 p-3 bg-yellow-500/10 rounded-md">
                        <p className="font-medium text-yellow-600 mb-1">Warnings:</p>
                        <ul className="text-sm text-muted-foreground">
                          {importResult529.results.errors.slice(0, 5).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {importResult529.results.errors.length > 5 && (
                            <li>...and {importResult529.results.errors.length - 5} more</li>
                          )}
                        </ul>
                      </div>
                    )}
                    <div className="mt-4 flex gap-2">
                      <Link href="/portfolio/holdings">
                        <Button>View Holdings</Button>
                      </Link>
                      <Button variant="outline" onClick={clearFile529}>Import Another</Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File Upload */}
          {!importResult529 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Upload 529 Statement PDF</CardTitle>
              </CardHeader>
              <CardContent>
                {!file529 ? (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragOver529 ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                    }`}
                    onDragOver={handleDragOver529}
                    onDragLeave={handleDragLeave529}
                    onDrop={handleDrop529}
                  >
                    <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-2">
                      Drag and drop your Vanguard 529 statement PDF here, or
                    </p>
                    <label className="inline-block">
                      <Input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={handleFile529Select}
                      />
                      <Button variant="outline" asChild>
                        <span>Browse Files</span>
                      </Button>
                    </label>
                    <p className="text-xs text-muted-foreground mt-4">
                      Download quarterly or year-end statements from Vanguard
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">{file529.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file529.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearFile529}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {error529 && (
                  <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm">{error529}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Preview */}
          {preview529 && !importResult529 && (
            <>
              {/* Summary */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Statement Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Statement Date</p>
                      <p className="text-2xl font-bold">{formatDate(preview529.statementDate)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(preview529.totalValue)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Beneficiaries</p>
                      <p className="text-2xl font-bold">{preview529.summary.accountCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Contributions</p>
                      <p className="text-2xl font-bold">{preview529.summary.contributionCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Import Options */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Import Options</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="importHoldings529"
                        checked={importHoldings529}
                        onChange={(e) => setImportHoldings529(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="importHoldings529">Import Holdings ({preview529.accounts.length} accounts)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="importContributions529"
                        checked={importContributions529}
                        onChange={(e) => setImportContributions529(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="importContributions529">Import Contributions ({preview529.contributions.length})</Label>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Each beneficiary will be created as a separate 529 account (e.g., "529 - Milan")
                  </p>
                </CardContent>
              </Card>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={active529Tab === 'accounts' ? 'default' : 'outline'}
                  onClick={() => setActive529Tab('accounts')}
                >
                  Accounts ({preview529.accounts.length})
                </Button>
                <Button
                  variant={active529Tab === 'contributions' ? 'default' : 'outline'}
                  onClick={() => setActive529Tab('contributions')}
                >
                  Contributions ({preview529.contributions.length})
                </Button>
              </div>

              {/* Accounts Table */}
              {active529Tab === 'accounts' && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>529 Accounts Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {preview529.accounts.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No accounts found in PDF</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Beneficiary</TableHead>
                              <TableHead>Portfolio</TableHead>
                              <TableHead className="text-right">Units</TableHead>
                              <TableHead className="text-right">Unit Value</TableHead>
                              <TableHead className="text-right">Total Value</TableHead>
                              <TableHead className="text-right">Principal</TableHead>
                              <TableHead className="text-right">Earnings</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preview529.accounts.map((account, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{account.beneficiaryName}</TableCell>
                                <TableCell>{account.portfolioName}</TableCell>
                                <TableCell className="text-right">{formatNumber(account.units, 4)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(account.unitValue)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(account.totalValue)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(account.principal)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(account.earnings)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Contributions Table */}
              {active529Tab === 'contributions' && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Contributions Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {preview529.contributions.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No contributions found in PDF</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Portfolio</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                              <TableHead className="text-right">Units</TableHead>
                              <TableHead className="text-right">Unit Value</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {preview529.contributions.map((contrib, i) => (
                              <TableRow key={i}>
                                <TableCell>{formatDate(contrib.tradeDate)}</TableCell>
                                <TableCell>{contrib.portfolioName}</TableCell>
                                <TableCell>{contrib.transactionType}</TableCell>
                                <TableCell className="text-right">{formatCurrency(contrib.amount)}</TableCell>
                                <TableCell className="text-right">{formatNumber(contrib.unitsTransacted, 4)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(contrib.unitValue)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Import Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={clearFile529}>Cancel</Button>
                <Button onClick={handleImport529} disabled={loading529 || (!importHoldings529 && !importContributions529)}>
                  {loading529 ? 'Importing...' : 'Import Data'}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </PageContainer>
  )
}
