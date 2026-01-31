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
import { GraduationCap, FileText, Check, AlertCircle, X } from 'lucide-react'

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
  rawText?: string
}

interface ImportResult {
  success: boolean
  results: {
    accountsCreated: number
    securitiesCreated: number
    holdingsImported: number
    contributionsImported?: number
    errors: string[]
  }
}

interface Vanguard529ImportProps {
  onComplete: () => void
}

export function Vanguard529Import({ onComplete }: Vanguard529ImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview529 | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importHoldings, setImportHoldings] = useState(true)
  const [importContributions, setImportContributions] = useState(true)
  const [isDragOver, setIsDragOver] = useState(false)
  const [activeTab, setActiveTab] = useState<'accounts' | 'contributions'>('accounts')

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
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.pdf')) {
      setFile(droppedFile)
      setError(null)
      setPreview(null)
      setImportResult(null)
      parseFile(droppedFile)
    } else {
      setError('Please drop a PDF file')
    }
  }, [])

  const parseFile = async (fileToparse: File) => {
    setLoading(true)
    setError(null)

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

      setPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF')
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
      formData.append('importContributions', importContributions.toString())

      const response = await fetch('/api/portfolio/import-529', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        const errorMsg = data.message || data.error || 'Failed to import PDF'
        throw new Error(errorMsg)
      }

      setImportResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import PDF')
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
              <p>Contributions imported: <span className="font-medium">{importResult.results.contributionsImported}</span></p>
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
          <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">
            Drag and drop your Vanguard 529 statement PDF here, or
          </p>
          <label className="inline-block">
            <Input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button variant="outline" asChild>
              <span>Browse Files</span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-4">
            Download quarterly or year-end statements from Vanguard
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
          <p>Parsing PDF...</p>
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
              <p className="text-sm text-muted-foreground">Statement Date</p>
              <p className="text-xl font-bold">{formatDate(preview.statementDate)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-xl font-bold">{formatCurrency(preview.totalValue)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Beneficiaries</p>
              <p className="text-xl font-bold">{preview.summary.accountCount}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Contributions</p>
              <p className="text-xl font-bold">{preview.summary.contributionCount}</p>
            </div>
          </div>

          {/* Import Options */}
          <div className="grid gap-4 md:grid-cols-2 p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="importHoldings529"
                checked={importHoldings}
                onChange={(e) => setImportHoldings(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="importHoldings529">Import Holdings ({preview.accounts.length} accounts)</Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="importContributions529"
                checked={importContributions}
                onChange={(e) => setImportContributions(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="importContributions529">Import Contributions ({preview.contributions.length})</Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Each beneficiary will be created as a separate 529 account (e.g., &quot;529 - Milan&quot;)
          </p>

          {/* Tabs */}
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'accounts' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('accounts')}
            >
              Accounts ({preview.accounts.length})
            </Button>
            <Button
              variant={activeTab === 'contributions' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('contributions')}
            >
              Contributions ({preview.contributions.length})
            </Button>
          </div>

          {/* Accounts Table */}
          {activeTab === 'accounts' && (
            <div className="border rounded-lg overflow-hidden">
              {preview.accounts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No accounts found in PDF</p>
              ) : (
                <div className="overflow-x-auto max-h-64">
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
                      {preview.accounts.map((account, i) => (
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
            </div>
          )}

          {/* Contributions Table */}
          {activeTab === 'contributions' && (
            <div className="border rounded-lg overflow-hidden">
              {preview.contributions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No contributions found in PDF</p>
              ) : (
                <div className="overflow-x-auto max-h-64">
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
                      {preview.contributions.map((contrib, i) => (
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
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={clearFile}>Cancel</Button>
            <Button onClick={handleImport} disabled={loading || (!importHoldings && !importContributions)}>
              {loading ? 'Importing...' : 'Import Data'}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
