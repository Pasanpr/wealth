'use client'

import { useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'

const importTypes = [
  {
    value: 'cashflow_spreadsheet',
    label: 'Credit Card Balances (Spreadsheet)',
    description: 'Import credit card balances from a spreadsheet with monthly columns',
    format: 'Sections like "Sheet 1: 2024" with monthly columns (January 2024, February 2024, etc.)',
    example: 'Rows: Sapphire Balance, Freedom Balance, Apple Card, Gap Visa with monthly values',
    isSpecial: true,
  },
  {
    value: 'income',
    label: 'Income Records',
    description: 'Import salary, RSU vesting, bonuses',
    format: 'date,income_type,amount,description,is_recurring',
    example: '2024-01-15,salary,8500.00,Monthly salary,true',
  },
  {
    value: 'holdings',
    label: 'Holdings Snapshot',
    description: 'Import holdings with values',
    format: 'date,account_name,symbol,value,shares,cost_basis',
    example: '2024-01-31,Fidelity Brokerage,VTSAX,50000.00,250,45000.00',
  },
  {
    value: 'securities',
    label: 'Securities',
    description: 'Import funds, ETFs, stocks',
    format: 'symbol,name,asset_class',
    example: 'VTSAX,Vanguard Total Stock Market Index,US Total Market',
  },
  {
    value: 'cash_flows',
    label: 'Cash Flows',
    description: 'Import contributions and withdrawals',
    format: 'date,account_name,amount,flow_type,description',
    example: '2024-01-15,Fidelity Brokerage,1000.00,contribution,Monthly contribution',
  },
  {
    value: 'tax_profile',
    label: 'Tax Profile',
    description: 'Import income and tax data',
    format: 'year,gross_income,federal_tax,state_tax',
    example: '2023,250000,45000,15000',
  },
]

interface ImportResult {
  imported: number
  errors: string[]
  details?: {
    months?: number
    cardBalances?: number
    cardsCreated?: number
  }
  cardsCreated?: string[]
}

export default function ImportPage() {
  const [selectedType, setSelectedType] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const selectedImportType = importTypes.find(t => t.value === selectedType)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setFile(files[0])
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (!file || !selectedType) return

    setImporting(true)
    setResult(null)

    try {
      // Special handling for cash flow spreadsheet import
      if (selectedType === 'cashflow_spreadsheet') {
        const csvContent = await file.text()

        const res = await fetch('/api/import/cashflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csvContent }),
        })

        const data = await res.json()

        if (!res.ok) {
          setResult({ imported: 0, errors: [data.error || 'Import failed', ...(data.details || [])] })
        } else {
          setResult({
            imported: data.imported?.months || 0,
            errors: [],
            details: data.imported,
            cardsCreated: data.cardsCreated,
          })
        }
      } else {
        // Standard import
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', selectedType)

        const res = await fetch('/api/import', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          setResult({ imported: 0, errors: [data.error || 'Import failed'] })
        } else {
          setResult(data)
        }
      }
    } catch (error) {
      setResult({ imported: 0, errors: ['Import failed. Please try again.'] })
    } finally {
      setImporting(false)
    }
  }

  return (
    <PageContainer
      title="Import Data"
      description="Import data from CSV files"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Import Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Data Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select data type to import" />
                </SelectTrigger>
                <SelectContent>
                  {importTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">CSV File</label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
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
            </div>

            <Button
              onClick={handleImport}
              disabled={!file || !selectedType || importing}
              className="w-full"
            >
              {importing ? 'Importing...' : 'Import Data'}
            </Button>

            {result && (
              <div className={`p-4 rounded-lg ${result.errors.length > 0 && result.imported === 0 ? 'bg-red-50' : result.errors.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {result.imported > 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {result.imported > 0
                      ? `Successfully imported ${result.imported} ${selectedType === 'cashflow_spreadsheet' ? 'months of data' : 'records'}`
                      : 'Import failed'}
                  </span>
                </div>
                {result.details && (
                  <div className="mt-2 text-sm text-green-700 space-y-1">
                    {result.details.cardBalances !== undefined && (
                      <p>{result.details.cardBalances} card balance records</p>
                    )}
                    {result.details.cardsCreated !== undefined && result.details.cardsCreated > 0 && (
                      <p>{result.details.cardsCreated} new cards created</p>
                    )}
                  </div>
                )}
                {result.cardsCreated && result.cardsCreated.length > 0 && (
                  <div className="mt-2 text-sm text-blue-700">
                    <p className="font-medium">Cards created:</p>
                    <ul className="list-disc list-inside">
                      {result.cardsCreated.map((card, i) => (
                        <li key={i}>{card}</li>
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
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Format Guide</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedImportType ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">{selectedImportType.label}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedImportType.description}
                  </p>
                </div>

                <div>
                  <h5 className="text-sm font-medium mb-2">Required Columns:</h5>
                  <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                    {selectedImportType.format}
                  </code>
                </div>

                <div>
                  <h5 className="text-sm font-medium mb-2">Example Row:</h5>
                  <code className="text-xs bg-muted p-2 rounded block overflow-x-auto">
                    {selectedImportType.example}
                  </code>
                </div>

                {selectedType === 'income' && (
                  <div className="text-sm text-muted-foreground">
                    <strong>income_type</strong> must be one of: salary, rsu_vesting, bonus, other
                  </div>
                )}

                {selectedType === 'holdings' && (
                  <div className="text-sm text-muted-foreground">
                    <strong>account_name</strong> and <strong>symbol</strong> must match existing accounts and securities
                  </div>
                )}

                {selectedType === 'cash_flows' && (
                  <div className="text-sm text-muted-foreground">
                    <strong>flow_type</strong> must be one of: contribution, withdrawal, dividend, interest
                  </div>
                )}

                {selectedType === 'cashflow_spreadsheet' && (
                  <div className="text-sm text-muted-foreground space-y-2">
                    <p>This import auto-detects credit card rows by looking for:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Rows containing &quot;Balance&quot; (e.g., Sapphire Balance)</li>
                      <li>Rows containing &quot;Card&quot; (e.g., Apple Card)</li>
                      <li>Rows containing card brands (Visa, Mastercard, Amex, etc.)</li>
                    </ul>
                    <p className="mt-2">The importer looks for sections titled &quot;Sheet 1: YYYY&quot; with monthly columns (January 2024, February 2024, etc.).</p>
                    <p>Credit cards will be created automatically if they don&apos;t exist.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a data type to see the required CSV format</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
