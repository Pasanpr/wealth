'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'

interface MonthlyBalancesImportProps {
  onComplete: () => void
}

interface ImportResult {
  imported: number
  errors: string[]
  details?: {
    months?: number
    cardBalances?: number
    cardsCreated?: number
    cashBalances?: number
    accountsCreated?: number
  }
  cardsCreated?: string[]
  accountsCreated?: string[]
}

export function MonthlyBalancesImport({ onComplete }: MonthlyBalancesImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setFile(files[0])
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setResult(null)

    try {
      const csvContent = await file.text()

      const res = await fetch('/api/import/spreadsheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResult({
          imported: 0,
          errors: [data.error || 'Import failed', ...(data.details || [])],
        })
      } else {
        setResult({
          imported: data.imported?.months || 0,
          errors: [],
          details: data.imported,
          cardsCreated: data.cardsCreated,
          accountsCreated: data.accountsCreated,
        })
      }
    } catch {
      setResult({ imported: 0, errors: ['Import failed. Please try again.'] })
    } finally {
      setImporting(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Format Guide */}
      <div className="p-4 bg-muted rounded-lg space-y-3">
        <p className="text-sm text-muted-foreground">
          This import extracts both credit cards and cash accounts in one pass.
        </p>
        <div>
          <h4 className="text-sm font-medium mb-1">Expected Format</h4>
          <p className="text-xs text-muted-foreground">
            Sections like &quot;Sheet 1: 2024&quot; with monthly columns (January 2024, February 2024, etc.)
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-1">Credit card rows detected by:</h4>
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            <li>Rows containing &quot;Balance&quot; (e.g., Sapphire Balance)</li>
            <li>Rows containing &quot;Card&quot; (e.g., Apple Card)</li>
            <li>Rows containing card brands (Visa, Mastercard, Amex, etc.)</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-1">Cash account rows detected by:</h4>
          <ul className="text-xs text-muted-foreground list-disc list-inside">
            <li>Rows containing &quot;Checking&quot;</li>
            <li>Rows containing &quot;Savings&quot;</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Cards and accounts will be created automatically if they don&apos;t exist.
        </p>
      </div>

      {/* File Upload */}
      {!result?.imported && (
        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="monthly-balances-input"
            />
            <label
              htmlFor="monthly-balances-input"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              {file ? (
                <span className="text-sm font-medium">{file.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Click to select a CSV file
                </span>
              )}
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={!file || importing}
              className="flex-1"
            >
              {importing ? 'Importing...' : 'Import Data'}
            </Button>
            {file && (
              <Button variant="outline" onClick={handleReset}>
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`p-4 rounded-lg ${
            result.errors.length > 0 && result.imported === 0
              ? 'bg-red-50 dark:bg-red-950'
              : result.errors.length > 0
              ? 'bg-yellow-50 dark:bg-yellow-950'
              : 'bg-green-50 dark:bg-green-950'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {result.imported > 0 ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="font-medium">
              {result.imported > 0
                ? `Successfully imported ${result.imported} months of data`
                : 'Import failed'}
            </span>
          </div>
          {result.details && (
            <div className="mt-2 text-sm text-green-700 dark:text-green-300 space-y-1">
              {result.details.cardBalances !== undefined &&
                result.details.cardBalances > 0 && (
                  <p>{result.details.cardBalances} credit card balance records</p>
                )}
              {result.details.cardsCreated !== undefined &&
                result.details.cardsCreated > 0 && (
                  <p>{result.details.cardsCreated} new cards created</p>
                )}
              {result.details.cashBalances !== undefined &&
                result.details.cashBalances > 0 && (
                  <p>{result.details.cashBalances} cash balance records</p>
                )}
              {result.details.accountsCreated !== undefined &&
                result.details.accountsCreated > 0 && (
                  <p>{result.details.accountsCreated} new accounts created</p>
                )}
            </div>
          )}
          {result.cardsCreated && result.cardsCreated.length > 0 && (
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">Cards created:</p>
              <ul className="list-disc list-inside">
                {result.cardsCreated.map((card, i) => (
                  <li key={i}>{card}</li>
                ))}
              </ul>
            </div>
          )}
          {result.accountsCreated && result.accountsCreated.length > 0 && (
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium">Accounts created:</p>
              <ul className="list-disc list-inside">
                {result.accountsCreated.map((account, i) => (
                  <li key={i}>{account}</li>
                ))}
              </ul>
            </div>
          )}
          {result.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-red-600 mb-1">Errors:</p>
              <ul className="text-sm text-red-600 list-disc list-inside">
                {result.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>...and {result.errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button onClick={onComplete}>Done</Button>
            <Button variant="outline" onClick={handleReset}>
              Import Another
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
