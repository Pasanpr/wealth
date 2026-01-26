'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { formatCurrency, formatDate, formatShares } from '@/lib/utils/format'
import { W2Form } from '@/lib/types'
import { ArrowLeft, Upload, FileText, Calculator, Check, AlertCircle, Loader2, X, Copy, CheckCheck, ChevronDown, ChevronRight, Bug, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface ParsedTransaction {
  vestDate: string
  saleDate: string
  shares: number
  vestPrice: number
  salePrice: number
  grossProceeds: number
  costBasis: number
  capitalGainLoss: number
  grantId: string | null
  hasWashSale: boolean
  termType: 'short' | 'long' | null
  selected: boolean
  taxesWithheld: number | null
  netProceeds: number | null
}

interface ParsedFileInfo {
  filename: string
  documentType: string
  taxYear: number | null
  transactionCount: number
  totals: {
    totalShares: number
    totalProceeds: number
    totalCostBasis: number
    totalGainLoss: number
  }
  rawText?: string
}

type TabType = 'upload' | 'w2' | 'manual'

export default function RsuImportPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [activeTab, setActiveTab] = useState<TabType>('upload')

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([])
  const [parsedTotals, setParsedTotals] = useState<{
    totalShares: number
    totalProceeds: number
    totalCostBasis: number
    totalGainLoss: number
  } | null>(null)
  const [parsedFiles, setParsedFiles] = useState<ParsedFileInfo[]>([])
  const [showDebug, setShowDebug] = useState(false)
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [mergedDocuments, setMergedDocuments] = useState(false)
  const [ignored1099B, setIgnored1099B] = useState(false)

  // Import state
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<number | null>(null)

  // W-2 data state (using new W2Form type)
  const [w2Data, setW2Data] = useState<W2Form[]>([])

  // Manual entry state
  const [manualForm, setManualForm] = useState({
    vestDate: '',
    saleDate: '',
    shares: '',
    vestPrice: '',
    salePrice: '',
    grossProceeds: '',
    taxesWithheld: '',
    netProceeds: '',
    grantId: '',
    grantDate: '',
    grantPrice: '',
  })

  useEffect(() => {
    fetchW2Data()
  }, [])

  const fetchW2Data = async () => {
    try {
      const res = await fetch('/api/w2')
      const data = await res.json()
      setW2Data(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch W-2 data:', error)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      setSelectedFiles(Array.from(files))
      setParseError(null)
      setParsedTransactions([])
      setParsedTotals(null)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.name.toLowerCase().endsWith('.pdf')
    )
    if (files.length > 0) {
      setSelectedFiles(files)
      setParseError(null)
      setParsedTransactions([])
      setParsedTotals(null)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const parseFiles = async () => {
    if (selectedFiles.length === 0) return

    setParsing(true)
    setParseError(null)

    try {
      const formData = new FormData()
      selectedFiles.forEach(file => formData.append('files', file))
      formData.append('previewOnly', 'true')

      const res = await fetch('/api/rsu/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse files')
      }

      if (data.transactions && data.transactions.length > 0) {
        setParsedTransactions(
          data.transactions.map((tx: ParsedTransaction) => ({
            ...tx,
            selected: true,
            taxesWithheld: null,
            netProceeds: null,
          }))
        )
        setParsedTotals(data.totals)
        // Store file info for debugging
        if (data.files) {
          setParsedFiles(data.files)
        }
        // Track if smart merge was used
        setMergedDocuments(data.mergedDocuments || false)
        // Track if 1099-B was ignored in favor of Supplement
        setIgnored1099B(data.ignored1099B || false)
      } else {
        setParseError('No RSU transactions found in the uploaded files')
      }
    } catch (error) {
      console.error('Parse error:', error)
      setParseError(error instanceof Error ? error.message : 'Failed to parse files')
    } finally {
      setParsing(false)
    }
  }

  const toggleTransactionSelection = (index: number) => {
    setParsedTransactions(prev =>
      prev.map((tx, i) => (i === index ? { ...tx, selected: !tx.selected } : tx))
    )
  }

  const updateTransactionField = (index: number, field: keyof ParsedTransaction, value: number | string | null) => {
    setParsedTransactions(prev =>
      prev.map((tx, i) => (i === index ? { ...tx, [field]: value } : tx))
    )
  }

  const allocateW2Taxes = () => {
    // Helper to get year from date string (YYYY-MM-DD) without timezone issues
    const getYearFromDateString = (dateStr: string): number => {
      // Parse YYYY-MM-DD directly to avoid timezone conversion issues
      const match = dateStr.match(/^(\d{4})-/)
      if (match) return parseInt(match[1], 10)
      // Fallback to Date parsing if format doesn't match
      return new Date(dateStr).getFullYear()
    }

    // First, check which years we need W-2 data for
    const years = [...new Set(parsedTransactions.map(tx => getYearFromDateString(tx.vestDate)))]
    const missingYears = years.filter(year => !w2Data.find(w => w.year === year))

    if (missingYears.length > 0) {
      alert(`No W-2 data found for: ${missingYears.join(', ')}. Add W-2 data in Settings > W-2 Forms first.\n\nTaxes withheld for RSUs relate to the vest year, not sale year.`)
      return
    }

    console.log('=== Tax Allocation Debug ===')
    console.log('Total transactions:', parsedTransactions.length)

    // Helper to get effective cost basis - use costBasis if available, otherwise calculate from shares × vestPrice
    const getEffectiveCostBasis = (tx: ParsedTransaction): number => {
      const directCostBasis = Number(tx.costBasis) || 0
      if (directCostBasis > 0) return directCostBasis
      // Fallback: calculate from shares × vestPrice (FMV at vest)
      const calculated = (Number(tx.shares) || 0) * (Number(tx.vestPrice) || 0)
      return calculated
    }

    // Build a map of year -> total cost basis for that year
    const yearTotals: Record<number, number> = {}
    for (const tx of parsedTransactions) {
      const year = getYearFromDateString(tx.vestDate)
      const costBasis = getEffectiveCostBasis(tx)
      yearTotals[year] = (yearTotals[year] || 0) + costBasis
      console.log(`  Building totals - TX vest=${tx.vestDate}, costBasis=${tx.costBasis}, effectiveCostBasis=${costBasis}, shares=${tx.shares}, vestPrice=${tx.vestPrice}, running total for ${year}=${yearTotals[year]}`)
    }

    console.log('Year totals:', JSON.stringify(yearTotals))
    console.log('W-2 data:', w2Data.map(w => ({ year: w.year, federal: w.federal_income_tax_withheld, state: w.state_income_tax_withheld })))

    // Map transactions with allocated taxes - use direct state update, not functional
    const updatedTransactions = parsedTransactions.map(tx => {
      const vestYear = getYearFromDateString(tx.vestDate)
      const yearW2 = w2Data.find(w => w.year === vestYear)

      if (!yearW2) {
        console.log(`No W-2 for year ${vestYear}`)
        return tx
      }

      // Use effective cost basis (with fallback to shares × vestPrice)
      const txCostBasis = getEffectiveCostBasis(tx)
      const yearTotalCostBasis = yearTotals[vestYear] || 0
      const yearTotalTax = Number(yearW2.federal_income_tax_withheld || 0) + Number(yearW2.state_income_tax_withheld || 0)

      // Proportional allocation based on this transaction's cost basis
      const proportion = yearTotalCostBasis > 0 ? txCostBasis / yearTotalCostBasis : 0
      const allocatedTax = Math.round(yearTotalTax * proportion * 100) / 100

      console.log(`TX ${tx.vestDate}: effectiveCostBasis=${txCostBasis}, yearTotal=${yearTotalCostBasis}, proportion=${proportion.toFixed(6)}, yearTax=${yearTotalTax}, allocated=${allocatedTax}`)

      return {
        ...tx,
        taxesWithheld: allocatedTax,
        netProceeds: Number(tx.grossProceeds || 0) - allocatedTax,
      }
    })

    console.log('=== End Tax Allocation Debug ===')
    setParsedTransactions(updatedTransactions)
  }

  const importTransactions = async () => {
    const selectedTx = parsedTransactions.filter(tx => tx.selected)
    if (selectedTx.length === 0) {
      alert('No transactions selected for import')
      return
    }

    setImporting(true)
    try {
      const res = await fetch('/api/rsu/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          records: selectedTx.map(tx => ({
            vestDate: tx.vestDate,
            saleDate: tx.saleDate,
            shares: tx.shares,
            vestPrice: tx.vestPrice,
            salePrice: tx.salePrice,
            grossProceeds: tx.grossProceeds,
            costBasis: tx.costBasis,
            taxesWithheld: tx.taxesWithheld,
            netProceeds: tx.netProceeds,
            grantId: tx.grantId,
          })),
        }),
      })

      if (!res.ok) throw new Error('Import failed')

      const data = await res.json()
      setImportSuccess(data.count)
      setParsedTransactions([])
      setParsedTotals(null)
      setParsedFiles([])
      setMergedDocuments(false)
      setIgnored1099B(false)
      setSelectedFiles([])
      setShowDebug(false)
    } catch (error) {
      console.error('Import failed:', error)
      alert('Failed to import records')
    } finally {
      setImporting(false)
    }
  }

  const saveManualEntry = async () => {
    if (!manualForm.vestDate || !manualForm.shares || !manualForm.vestPrice) {
      alert('Vest date, shares, and vest price are required')
      return
    }

    try {
      const res = await fetch('/api/rsu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vest_date: manualForm.vestDate,
          shares: parseFloat(manualForm.shares),
          grant_price: parseFloat(manualForm.grantPrice) || parseFloat(manualForm.vestPrice),
          grant_date: manualForm.grantDate || manualForm.vestDate,
          grant_id: manualForm.grantId || null,
          is_vested: true,
          actual_price_at_vest: parseFloat(manualForm.vestPrice),
          sale_date: manualForm.saleDate || null,
          sale_price: manualForm.salePrice ? parseFloat(manualForm.salePrice) : null,
          gross_proceeds: manualForm.grossProceeds ? parseFloat(manualForm.grossProceeds) : null,
          taxes_withheld: manualForm.taxesWithheld ? parseFloat(manualForm.taxesWithheld) : null,
          net_proceeds: manualForm.netProceeds ? parseFloat(manualForm.netProceeds) : null,
        }),
      })

      if (!res.ok) throw new Error('Save failed')

      alert('RSU record saved successfully')
      setManualForm({
        vestDate: '',
        saleDate: '',
        shares: '',
        vestPrice: '',
        salePrice: '',
        grossProceeds: '',
        taxesWithheld: '',
        netProceeds: '',
        grantId: '',
        grantDate: '',
        grantPrice: '',
      })
    } catch (error) {
      console.error('Failed to save:', error)
      alert('Failed to save RSU record')
    }
  }

  const handleManualChange = (field: string, value: string) => {
    const updated = { ...manualForm, [field]: value }

    if (field === 'shares' || field === 'salePrice') {
      const shares = parseFloat(field === 'shares' ? value : manualForm.shares)
      const salePrice = parseFloat(field === 'salePrice' ? value : manualForm.salePrice)
      if (!isNaN(shares) && !isNaN(salePrice)) {
        updated.grossProceeds = (shares * salePrice).toFixed(2)
      }
    }

    if (field === 'grossProceeds' || field === 'taxesWithheld') {
      const gross = parseFloat(field === 'grossProceeds' ? value : updated.grossProceeds)
      const taxes = parseFloat(field === 'taxesWithheld' ? value : manualForm.taxesWithheld)
      if (!isNaN(gross) && !isNaN(taxes)) {
        updated.netProceeds = (gross - taxes).toFixed(2)
      }
    }

    setManualForm(updated)
  }

  return (
    <PageContainer
      title="Import RSU Data"
      description="Import historical RSU data from tax documents or add manual entries"
      actions={
        <Link href="/cash/rsu">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to RSU
          </Button>
        </Link>
      }
    >
      {importSuccess && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg flex items-center gap-2">
          <Check className="h-5 w-5 text-green-600" />
          <span>Successfully imported {importSuccess} RSU records!</span>
          <Button variant="outline" size="sm" onClick={() => router.push('/cash/rsu')}>
            View Records
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'upload' ? 'default' : 'outline'}
          onClick={() => setActiveTab('upload')}
        >
          <FileText className="mr-2 h-4 w-4" />
          Upload PDF
        </Button>
        <Button
          variant={activeTab === 'w2' ? 'default' : 'outline'}
          onClick={() => setActiveTab('w2')}
        >
          <Calculator className="mr-2 h-4 w-4" />
          W-2 Tax Data
        </Button>
        <Button
          variant={activeTab === 'manual' ? 'default' : 'outline'}
          onClick={() => setActiveTab('manual')}
        >
          <Upload className="mr-2 h-4 w-4" />
          Manual Entry
        </Button>
      </div>

      {/* Upload Tab */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload E*Trade Tax Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Upload your E*Trade Stock Plan Transactions Supplement or 1099-B PDF.
                The system will automatically extract all RSU transactions.
              </p>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium">Drop PDF files here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports E*Trade Stock Plan Supplement and 1099-B documents
                </p>
              </div>

              {/* Selected files */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded-md"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Button
                  onClick={parseFiles}
                  disabled={selectedFiles.length === 0 || parsing}
                >
                  {parsing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    'Parse Documents'
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFiles([])
                    setParsedTransactions([])
                    setParsedTotals(null)
                    setParsedFiles([])
                    setMergedDocuments(false)
                    setIgnored1099B(false)
                    setParseError(null)
                    setShowDebug(false)
                  }}
                >
                  Clear
                </Button>
              </div>

              {parseError && (
                <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 rounded-md flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm">{parseError}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Parsed Transactions */}
          {parsedTransactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>Parsed Transactions ({parsedTransactions.filter(tx => tx.selected).length} selected)</span>
                    {ignored1099B && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        Using Supplement Only
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {w2Data.length > 0 && (
                      <Button variant="outline" size="sm" onClick={allocateW2Taxes}>
                        <Calculator className="mr-2 h-4 w-4" />
                        Allocate W-2 Taxes
                      </Button>
                    )}
                    <Button
                      onClick={importTransactions}
                      disabled={importing || parsedTransactions.filter(tx => tx.selected).length === 0}
                    >
                      {importing ? 'Importing...' : 'Import Selected'}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Import</TableHead>
                        <TableHead>Vest Date</TableHead>
                        <TableHead>Sale Date</TableHead>
                        <TableHead className="text-right">Shares</TableHead>
                        <TableHead className="text-right">Vest Price</TableHead>
                        <TableHead className="text-right">Sale Price</TableHead>
                        <TableHead className="text-right">Proceeds</TableHead>
                        <TableHead className="text-right">Cost Basis</TableHead>
                        <TableHead className="text-right">Gain/Loss</TableHead>
                        <TableHead className="text-right">Taxes</TableHead>
                        <TableHead>Grant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedTransactions.map((tx, index) => (
                        <TableRow key={index} className={!tx.selected ? 'opacity-50' : ''}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={tx.selected}
                              onChange={() => toggleTransactionSelection(index)}
                            />
                          </TableCell>
                          <TableCell>{formatDate(tx.vestDate)}</TableCell>
                          <TableCell>{formatDate(tx.saleDate)}</TableCell>
                          <TableCell className="text-right">{formatShares(tx.shares)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.vestPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.salePrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.grossProceeds)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(tx.costBasis)}</TableCell>
                          <TableCell className={`text-right ${tx.capitalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(tx.capitalGainLoss)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-24 h-7 text-xs text-right"
                              value={tx.taxesWithheld || ''}
                              onChange={e => updateTransactionField(index, 'taxesWithheld', e.target.value ? parseFloat(e.target.value) : null)}
                              placeholder="—"
                            />
                          </TableCell>
                          <TableCell className="text-xs">
                            {tx.grantId || '—'}
                            {tx.hasWashSale && (
                              <span className="ml-1 text-yellow-600" title="Wash Sale">WS</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Shares:</span>{' '}
                      <strong>{formatShares(parsedTransactions.filter(tx => tx.selected).reduce((s, tx) => s + tx.shares, 0))}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Proceeds:</span>{' '}
                      <strong>{formatCurrency(parsedTransactions.filter(tx => tx.selected).reduce((s, tx) => s + tx.grossProceeds, 0))}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Cost Basis:</span>{' '}
                      <strong>{formatCurrency(parsedTransactions.filter(tx => tx.selected).reduce((s, tx) => s + tx.costBasis, 0))}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Capital Gain/Loss:</span>{' '}
                      <strong className={parsedTransactions.filter(tx => tx.selected).reduce((s, tx) => s + tx.capitalGainLoss, 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatCurrency(parsedTransactions.filter(tx => tx.selected).reduce((s, tx) => s + tx.capitalGainLoss, 0))}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Info notice when 1099-B was ignored */}
                {ignored1099B && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md text-sm">
                    <strong className="text-amber-800 dark:text-amber-200">Note:</strong>{' '}
                    <span className="text-amber-700 dark:text-amber-300">
                      1099-B data was ignored in favor of Stock Plan Supplement. The Supplement has accurate cost basis and grant IDs needed for proper tax reporting.
                    </span>
                  </div>
                )}

                {/* Debug Section */}
                {parsedFiles.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowDebug(!showDebug)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showDebug ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <Bug className="h-4 w-4" />
                      Debug: View LLM Extracted Data
                    </button>

                    {showDebug && (
                      <div className="mt-3 space-y-3">
                        {parsedFiles.map((file, index) => (
                          <div key={index} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{file.filename}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({file.documentType}, {file.transactionCount} transactions)
                                </span>
                              </div>
                              {file.rawText && (
                                <button
                                  onClick={async () => {
                                    await navigator.clipboard.writeText(file.rawText!)
                                    setCopiedRaw(true)
                                    setTimeout(() => setCopiedRaw(false), 2000)
                                  }}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {copiedRaw ? (
                                    <>
                                      <CheckCheck className="h-3 w-3 text-green-500" />
                                      <span className="text-green-500">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Copy JSON</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            {file.rawText && (
                              <pre className="p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                                {file.rawText}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* W-2 Tab */}
      {activeTab === 'w2' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>W-2 Tax Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                W-2 data is used to allocate tax withholding to individual RSU transactions.
                When you have W-2 data for the same year as your RSU transactions, you can use
                the &quot;Allocate W-2 Taxes&quot; button to proportionally distribute taxes.
              </p>

              <Link href="/settings/w2">
                <Button>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Manage W-2 Forms
                </Button>
              </Link>

              {w2Data.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium mb-3">Available W-2 Data</h4>
                  <div className="space-y-3">
                    {w2Data.map(w2 => (
                      <div key={w2.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{w2.year} - {w2.employer_name}</h4>
                          <span className="text-sm text-muted-foreground">
                            {((w2.federal_income_tax_withheld + w2.state_income_tax_withheld) / w2.wages_tips_compensation * 100).toFixed(1)}% effective rate
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Wages: <strong>{formatCurrency(w2.wages_tips_compensation)}</strong></div>
                          <div>Federal Tax: <strong>{formatCurrency(w2.federal_income_tax_withheld)}</strong></div>
                          <div>State Tax: <strong>{formatCurrency(w2.state_income_tax_withheld)}</strong></div>
                          <div>Total Tax: <strong>{formatCurrency(w2.federal_income_tax_withheld + w2.state_income_tax_withheld)}</strong></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {w2Data.length === 0 && (
                <div className="mt-4 p-4 bg-muted rounded-lg text-sm text-muted-foreground">
                  No W-2 data found. Add your W-2 forms to enable tax allocation for RSU transactions.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manual Entry Tab */}
      {activeTab === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle>Manual RSU Entry</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Add individual RSU transactions manually. Use this for current-year trades or corrections.
            </p>
            <div className="grid gap-4">
              <div className="text-sm font-medium text-muted-foreground">Vesting Information</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="manual-vest-date">Vest Date *</Label>
                  <Input
                    id="manual-vest-date"
                    type="date"
                    value={manualForm.vestDate}
                    onChange={e => handleManualChange('vestDate', e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-shares">Shares *</Label>
                  <Input
                    id="manual-shares"
                    type="number"
                    step="0.0001"
                    value={manualForm.shares}
                    onChange={e => handleManualChange('shares', e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-vest-price">Vest Price (FMV) *</Label>
                  <Input
                    id="manual-vest-price"
                    type="number"
                    step="0.01"
                    value={manualForm.vestPrice}
                    onChange={e => handleManualChange('vestPrice', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="text-sm font-medium text-muted-foreground mt-4">Sale Information (if sold)</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="manual-sale-date">Sale Date</Label>
                  <Input
                    id="manual-sale-date"
                    type="date"
                    value={manualForm.saleDate}
                    onChange={e => handleManualChange('saleDate', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-sale-price">Sale Price</Label>
                  <Input
                    id="manual-sale-price"
                    type="number"
                    step="0.01"
                    value={manualForm.salePrice}
                    onChange={e => handleManualChange('salePrice', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-gross-proceeds">Gross Proceeds</Label>
                  <Input
                    id="manual-gross-proceeds"
                    type="number"
                    step="0.01"
                    value={manualForm.grossProceeds}
                    onChange={e => handleManualChange('grossProceeds', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="manual-taxes">Taxes Withheld</Label>
                  <Input
                    id="manual-taxes"
                    type="number"
                    step="0.01"
                    value={manualForm.taxesWithheld}
                    onChange={e => handleManualChange('taxesWithheld', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-net">Net Proceeds</Label>
                  <Input
                    id="manual-net"
                    type="number"
                    step="0.01"
                    value={manualForm.netProceeds}
                    onChange={e => handleManualChange('netProceeds', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-grant-id">Grant ID</Label>
                  <Input
                    id="manual-grant-id"
                    value={manualForm.grantId}
                    onChange={e => handleManualChange('grantId', e.target.value)}
                    placeholder="e.g., B17868"
                  />
                </div>
              </div>

              <div className="text-sm font-medium text-muted-foreground mt-4">Grant Information (optional)</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="manual-grant-date">Grant Date</Label>
                  <Input
                    id="manual-grant-date"
                    type="date"
                    value={manualForm.grantDate}
                    onChange={e => handleManualChange('grantDate', e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="manual-grant-price">Grant Price</Label>
                  <Input
                    id="manual-grant-price"
                    type="number"
                    step="0.01"
                    value={manualForm.grantPrice}
                    onChange={e => handleManualChange('grantPrice', e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={saveManualEntry} className="mt-4">
                Save RSU Record
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
