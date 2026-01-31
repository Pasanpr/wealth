'use client'

import { useState, useRef, useCallback } from 'react'
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
import { formatCurrency, formatDate, formatShares } from '@/lib/utils/format'
import { Upload, FileText, Check, AlertCircle, X, Loader2 } from 'lucide-react'

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

interface RsuImportProps {
  onComplete: () => void
}

export function RsuImport({ onComplete }: RsuImportProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const [ignored1099B, setIgnored1099B] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSuccess, setImportSuccess] = useState<number | null>(null)

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
        if (data.files) {
          setParsedFiles(data.files)
        }
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
      setIgnored1099B(false)
      setSelectedFiles([])
    } catch (error) {
      console.error('Import failed:', error)
      alert('Failed to import records')
    } finally {
      setImporting(false)
    }
  }

  const clearAll = () => {
    setSelectedFiles([])
    setParsedTransactions([])
    setParsedTotals(null)
    setParsedFiles([])
    setIgnored1099B(false)
    setParseError(null)
    setImportSuccess(null)
  }

  // Import success view
  if (importSuccess) {
    return (
      <div className="pt-4">
        <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
          <Check className="h-8 w-8 text-green-600" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
            <p>Successfully imported {importSuccess} RSU records!</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={onComplete}>Done</Button>
              <Button variant="outline" onClick={clearAll}>Import More</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">
        Upload your E*Trade Stock Plan Transactions Supplement or 1099-B PDF.
        The system will automatically extract all RSU transactions.
      </p>

      {/* Drop zone */}
      {!parsedTransactions.length && (
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
      )}

      {/* Selected files */}
      {selectedFiles.length > 0 && !parsedTransactions.length && (
        <div className="space-y-2">
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
              <Button variant="ghost" size="sm" onClick={() => removeFile(index)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {selectedFiles.length > 0 && !parsedTransactions.length && (
        <div className="flex gap-2">
          <Button onClick={parseFiles} disabled={parsing}>
            {parsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              'Parse Documents'
            )}
          </Button>
          <Button variant="outline" onClick={clearAll}>Clear</Button>
        </div>
      )}

      {parseError && (
        <div className="p-3 bg-red-100 dark:bg-red-900 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm">{parseError}</span>
        </div>
      )}

      {/* Parsed Transactions */}
      {parsedTransactions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                Parsed Transactions ({parsedTransactions.filter(tx => tx.selected).length} selected)
              </span>
              {ignored1099B && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Using Supplement Only
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                onClick={importTransactions}
                disabled={importing || parsedTransactions.filter(tx => tx.selected).length === 0}
              >
                {importing ? 'Importing...' : 'Import Selected'}
              </Button>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-64">
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
                      <TableCell className="text-xs">{formatDate(tx.vestDate)}</TableCell>
                      <TableCell className="text-xs">{formatDate(tx.saleDate)}</TableCell>
                      <TableCell className="text-right">{formatShares(tx.shares)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(tx.vestPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(tx.salePrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(tx.grossProceeds)}</TableCell>
                      <TableCell className={`text-right ${tx.capitalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(tx.capitalGainLoss)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          className="w-20 h-7 text-xs text-right"
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
          </div>

          {/* Totals */}
          <div className="p-3 bg-muted rounded-md">
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

          {ignored1099B && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md text-sm">
              <strong className="text-amber-800 dark:text-amber-200">Note:</strong>{' '}
              <span className="text-amber-700 dark:text-amber-300">
                1099-B data was ignored in favor of Stock Plan Supplement.
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={clearAll}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
