'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { formatDate, formatShares } from '@/lib/utils/format'
import { FileSpreadsheet, X, Check, AlertCircle, Loader2 } from 'lucide-react'
import { ETradeGrant, UpcomingVest, CompletedVest, ParsedETradeData } from '@/lib/services/csv/etrade-benefits-parser'

interface EtradeCsvImportProps {
  onComplete: () => void
}

export function EtradeCsvImport({ onComplete }: EtradeCsvImportProps) {
  const csvInputRef = useRef<HTMLInputElement>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvParsing, setCsvParsing] = useState(false)
  const [csvError, setCsvError] = useState<string | null>(null)
  const [csvPreview, setCsvPreview] = useState<ParsedETradeData | null>(null)
  const [csvImporting, setCsvImporting] = useState(false)
  const [csvImportSuccess, setCsvImportSuccess] = useState<number | null>(null)

  const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
      setCsvError(null)
      setCsvPreview(null)
      setCsvImportSuccess(null)
    }
  }

  const handleCsvDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = Array.from(e.dataTransfer.files).find(f =>
      f.name.toLowerCase().endsWith('.csv')
    )
    if (file) {
      setCsvFile(file)
      setCsvError(null)
      setCsvPreview(null)
      setCsvImportSuccess(null)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const parseCsvFile = async () => {
    if (!csvFile) return

    setCsvParsing(true)
    setCsvError(null)

    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('previewOnly', 'true')

      const res = await fetch('/api/rsu/import-csv', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to parse CSV')
      }

      setCsvPreview({
        grants: data.grants,
        vestSchedules: [],
        upcomingVests: data.upcomingVests,
        completedVests: data.completedVests,
      })
    } catch (error) {
      console.error('CSV parse error:', error)
      setCsvError(error instanceof Error ? error.message : 'Failed to parse CSV')
    } finally {
      setCsvParsing(false)
    }
  }

  const importCsvData = async () => {
    if (!csvFile || !csvPreview) return

    setCsvImporting(true)

    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('previewOnly', 'false')
      formData.append('currentPrice', '0')

      const res = await fetch('/api/rsu/import-csv', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to import CSV')
      }

      setCsvImportSuccess(data.count)
      setCsvFile(null)
      setCsvPreview(null)
    } catch (error) {
      console.error('CSV import error:', error)
      alert(error instanceof Error ? error.message : 'Failed to import CSV')
    } finally {
      setCsvImporting(false)
    }
  }

  const clearCsv = () => {
    setCsvFile(null)
    setCsvPreview(null)
    setCsvError(null)
    setCsvImportSuccess(null)
    if (csvInputRef.current) {
      csvInputRef.current.value = ''
    }
  }

  // Import success view
  if (csvImportSuccess) {
    return (
      <div className="pt-4">
        <div className="flex items-start gap-4 p-4 bg-green-50 dark:bg-green-950 rounded-lg">
          <Check className="h-8 w-8 text-green-600" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
            <p>Successfully imported {csvImportSuccess} upcoming vests!</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={onComplete}>Done</Button>
              <Button variant="outline" onClick={clearCsv}>Import Another</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pt-4">
      <p className="text-sm text-muted-foreground">
        Upload your E*Trade Stock Plan Benefits CSV export (ByBenefitType_expanded.csv).
        This will import your upcoming vest schedule to track projected income.
      </p>

      {/* Drop zone */}
      {!csvPreview && (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onDrop={handleCsvDrop}
          onDragOver={handleDragOver}
          onClick={() => csvInputRef.current?.click()}
        >
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvSelect}
            className="hidden"
          />
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">
            Export from E*Trade: Stock Plan &gt; Holdings &gt; Benefit Type &gt; Expanded View &gt; Export
          </p>
        </div>
      )}

      {/* Selected file */}
      {csvFile && !csvPreview && (
        <div className="flex items-center justify-between p-2 bg-muted rounded-md">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="text-sm">{csvFile.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(csvFile.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={clearCsv}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {csvFile && !csvPreview && (
        <div className="flex gap-2">
          <Button onClick={parseCsvFile} disabled={csvParsing}>
            {csvParsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              'Preview Data'
            )}
          </Button>
          <Button variant="outline" onClick={clearCsv}>Clear</Button>
        </div>
      )}

      {csvError && (
        <div className="p-3 bg-red-100 dark:bg-red-900 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm">{csvError}</span>
        </div>
      )}

      {/* Preview Data */}
      {csvPreview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Preview: {csvPreview.upcomingVests.length} Upcoming Vests</span>
            <Button
              onClick={importCsvData}
              disabled={csvImporting || csvPreview.upcomingVests.length === 0}
            >
              {csvImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Upcoming Vests'
              )}
            </Button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{csvPreview.grants.length}</div>
              <div className="text-sm text-muted-foreground">Active Grants</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{csvPreview.upcomingVests.reduce((sum, v) => sum + v.shares, 0)}</div>
              <div className="text-sm text-muted-foreground">Unvested Shares</div>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{csvPreview.completedVests.reduce((sum, v) => sum + v.shares, 0)}</div>
              <div className="text-sm text-muted-foreground">Already Vested</div>
            </div>
          </div>

          {/* Grants List */}
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <h4 className="font-medium">Grants</h4>
            </div>
            <div className="overflow-x-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grant ID</TableHead>
                    <TableHead>Grant Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Vested</TableHead>
                    <TableHead className="text-right">Unvested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvPreview.grants.map((grant, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-sm">{grant.grantId}</TableCell>
                      <TableCell>{formatDate(grant.grantDate)}</TableCell>
                      <TableCell className="text-xs">{grant.grantReason}</TableCell>
                      <TableCell className="text-right">{formatShares(grant.grantedQty)}</TableCell>
                      <TableCell className="text-right">{formatShares(grant.vestedQty)}</TableCell>
                      <TableCell className="text-right">{formatShares(grant.unvestedQty)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Upcoming Vests */}
          <div className="border rounded-lg overflow-hidden">
            <div className="p-3 border-b bg-muted">
              <h4 className="font-medium">Upcoming Vests (to be imported)</h4>
            </div>
            <div className="overflow-x-auto max-h-48">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vest Date</TableHead>
                    <TableHead>Grant ID</TableHead>
                    <TableHead>Grant Date</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvPreview.upcomingVests.map((vest, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{formatDate(vest.vestDate)}</TableCell>
                      <TableCell className="font-mono text-sm">{vest.grantId}</TableCell>
                      <TableCell>{formatDate(vest.grantDate)}</TableCell>
                      <TableCell className="text-right">{formatShares(vest.shares)}</TableCell>
                      <TableCell className="text-xs">{vest.grantReason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={clearCsv}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  )
}
