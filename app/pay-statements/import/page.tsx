'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { ImportDropzone } from '@/components/pay-statements/import-dropzone'
import { ImportPreview } from '@/components/pay-statements/import-preview'
import { ParsedPayStatement } from '@/lib/types'
import { AlertCircle, CheckCircle } from 'lucide-react'

interface PreviewItem {
  filename: string
  data: ParsedPayStatement
  fileHash: string
  rawText?: string
}

interface ImportResult {
  filename: string
  success: boolean
  statementId?: number
  payDate?: string
  error?: string
  isDuplicate?: boolean
}

interface ParsingProgress {
  total: number
  completed: number
  currentFile: string
  successes: PreviewItem[]
  failures: ImportResult[]
}

export default function ImportPayStatementsPage() {
  const router = useRouter()
  const [step, setStep] = useState<'upload' | 'parsing' | 'preview' | 'importing' | 'complete'>('upload')
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [importResults, setImportResults] = useState<ImportResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [parsingProgress, setParsingProgress] = useState<ParsingProgress>({
    total: 0,
    completed: 0,
    currentFile: '',
    successes: [],
    failures: [],
  })

  const handleFilesSelected = async (files: File[]) => {
    setError(null)
    setStep('parsing')

    const progress: ParsingProgress = {
      total: files.length,
      completed: 0,
      currentFile: '',
      successes: [],
      failures: [],
    }
    setParsingProgress(progress)

    // Process files one at a time for real-time progress
    for (const file of files) {
      progress.currentFile = file.name
      setParsingProgress({ ...progress })

      try {
        const formData = new FormData()
        formData.append('files', file)
        formData.append('previewOnly', 'true')

        const res = await fetch('/api/pay-statements/import', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()

        if (!res.ok) {
          progress.failures.push({
            filename: file.name,
            success: false,
            error: data.error || 'Failed to parse',
          })
        } else {
          // Add successful parses
          const validItems = data.statements || []
          const errors = data.results?.filter((r: ImportResult) => !r.success) || []

          progress.successes.push(...validItems)
          progress.failures.push(...errors)
        }
      } catch (err) {
        progress.failures.push({
          filename: file.name,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }

      progress.completed++
      setParsingProgress({ ...progress })
    }

    // Done processing all files
    if (progress.successes.length === 0 && progress.failures.length > 0) {
      setError(
        `No valid statements found. ${progress.failures.map(e => e.error).join('. ')}`
      )
      setStep('upload')
      return
    }

    setPreviewItems(progress.successes)
    setImportResults(progress.failures)
    setStep('preview')
  }

  const handleConfirmImport = async () => {
    setStep('importing')

    try {
      const results: ImportResult[] = []

      for (const item of previewItems) {
        try {
          const importRes = await fetch('/api/pay-statements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...item.data,
              fileHash: item.fileHash,
            }),
          })

          if (importRes.ok) {
            const statement = await importRes.json()
            results.push({
              filename: item.filename,
              success: true,
              statementId: statement.id,
              payDate: statement.pay_date,
            })
          } else {
            const err = await importRes.json()
            results.push({
              filename: item.filename,
              success: false,
              error: err.error || 'Failed to import',
              isDuplicate: err.isDuplicate,
            })
          }
        } catch (err) {
          results.push({
            filename: item.filename,
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          })
        }
      }

      setImportResults(results)
      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import statements')
      setStep('preview')
    }
  }

  const handleCancel = () => {
    setStep('upload')
    setPreviewItems([])
    setImportResults([])
    setError(null)
  }

  const handleDone = () => {
    router.push('/pay-statements')
  }

  return (
    <PageContainer
      title="Import Pay Statements"
      description="Upload ADP pay stub PDFs to import earnings data"
    >
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF Files</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportDropzone onFilesSelected={handleFilesSelected} />
            {error && (
              <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {step === 'parsing' && (
        <Card>
          <CardContent className="p-8">
            <div className="space-y-6">
              {/* Progress header */}
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-lg font-medium">
                  Parsing PDFs ({parsingProgress.completed}/{parsingProgress.total})
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Using AI to extract pay statement data
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(parsingProgress.completed / parsingProgress.total) * 100}%` }}
                />
              </div>

              {/* Current file */}
              {parsingProgress.currentFile && (
                <p className="text-sm text-center text-muted-foreground">
                  Processing: <span className="font-medium text-foreground">{parsingProgress.currentFile}</span>
                </p>
              )}

              {/* Results so far */}
              {(parsingProgress.successes.length > 0 || parsingProgress.failures.length > 0) && (
                <div className="flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{parsingProgress.successes.length} parsed</span>
                  </div>
                  {parsingProgress.failures.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span>{parsingProgress.failures.length} failed</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <>
          {/* Show failed/skipped files */}
          {importResults.length > 0 && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  {importResults.length} file{importResults.length !== 1 ? 's' : ''} skipped
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {importResults.map((result, i) => (
                    <div
                      key={i}
                      className="p-3 bg-destructive/10 rounded-lg flex items-center justify-between"
                    >
                      <span className="text-sm font-medium">{result.filename}</span>
                      <span className="text-sm text-destructive">{result.error}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          <ImportPreview
            items={previewItems}
            onConfirm={handleConfirmImport}
            onCancel={handleCancel}
          />
        </>
      )}

      {step === 'importing' && (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-lg font-medium">Importing statements...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'complete' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Import Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-500">
                    {importResults.filter(r => r.success).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Successfully imported</p>
                </div>
                <div className="p-4 bg-destructive/10 rounded-lg">
                  <p className="text-2xl font-bold text-destructive">
                    {importResults.filter(r => !r.success).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
              </div>

              <div className="space-y-2">
                {importResults.map((result, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-lg flex items-center justify-between ${
                      result.success ? 'bg-green-500/10' : 'bg-destructive/10'
                    }`}
                  >
                    <span className="text-sm font-medium">{result.filename}</span>
                    {result.success ? (
                      <span className="text-sm text-green-500">
                        Imported ({result.payDate})
                      </span>
                    ) : (
                      <span className="text-sm text-destructive">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-accent"
                >
                  Import More
                </button>
                <button
                  onClick={handleDone}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  View Statements
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
