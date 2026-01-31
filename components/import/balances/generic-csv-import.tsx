'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'

interface GenericCsvImportProps {
  importType: string
  format: string
  example: string
  helpText?: string
  onComplete: () => void
}

interface ImportResult {
  imported: number
  errors: string[]
}

export function GenericCsvImport({
  importType,
  format,
  example,
  helpText,
  onComplete,
}: GenericCsvImportProps) {
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
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', importType)

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
        <div>
          <h4 className="text-sm font-medium mb-1">Required Columns</h4>
          <code className="text-xs bg-background p-2 rounded block overflow-x-auto">
            {format}
          </code>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-1">Example Row</h4>
          <code className="text-xs bg-background p-2 rounded block overflow-x-auto">
            {example}
          </code>
        </div>
        {helpText && (
          <p className="text-xs text-muted-foreground">{helpText}</p>
        )}
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
              id="csv-file-input"
            />
            <label
              htmlFor="csv-file-input"
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
                ? `Successfully imported ${result.imported} records`
                : 'Import failed'}
            </span>
          </div>
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
