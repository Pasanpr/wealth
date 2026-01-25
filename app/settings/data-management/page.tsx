'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui'
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react'

interface SectionInfo {
  name: string
  tables: string[]
  description: string
}

interface Section {
  info: SectionInfo
  recordCount: number
}

type SectionKey =
  | 'pay_statements'
  | 'portfolio'
  | 'income'
  | 'credit_cards'
  | 'cash'
  | 'expenses'

export default function DataManagementPage() {
  const [sections, setSections] = useState<Record<SectionKey, Section> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSections, setSelectedSections] = useState<Set<SectionKey>>(new Set())
  const [resetting, setResetting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const fetchSections = async () => {
    try {
      const res = await fetch('/api/settings/reset')
      if (res.ok) {
        const data = await res.json()
        setSections(data.sections)
      }
    } catch (error) {
      console.error('Failed to fetch sections:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSections()
  }, [])

  const toggleSection = (key: SectionKey) => {
    setSelectedSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
    setResult(null)
  }

  const handleReset = async () => {
    if (selectedSections.size === 0) return

    setResetting(true)
    setResult(null)

    try {
      const res = await fetch('/api/settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: Array.from(selectedSections),
          confirm: true,
        }),
      })

      const data = await res.json()

      if (res.ok) {
        setResult({ success: true, message: data.message })
        setSelectedSections(new Set())
        fetchSections()
      } else {
        setResult({ success: false, message: data.error || 'Reset failed' })
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Reset failed',
      })
    } finally {
      setResetting(false)
      setShowConfirm(false)
    }
  }

  if (loading) {
    return (
      <PageContainer title="Data Management">
        <div className="text-muted-foreground">Loading...</div>
      </PageContainer>
    )
  }

  const totalSelected = Array.from(selectedSections).reduce((sum, key) => {
    return sum + (sections?.[key]?.recordCount ?? 0)
  }, 0)

  return (
    <PageContainer
      title="Data Management"
      description="Reset specific sections of the database"
    >
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Select the data sections you want to reset. This action is irreversible
            and will permanently delete all records in the selected sections.
          </p>

          <div className="grid gap-3">
            {sections &&
              (Object.entries(sections) as [SectionKey, Section][]).map(
                ([key, section]) => (
                  <label
                    key={key}
                    className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedSections.has(key)
                        ? 'border-destructive bg-destructive/5'
                        : 'border-border hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedSections.has(key)}
                        onChange={() => toggleSection(key)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <div>
                        <span className="font-medium">{section.info.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {section.info.description}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-mono ${
                        section.recordCount > 0
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {section.recordCount} records
                    </span>
                  </label>
                )
              )}
          </div>

          {result && (
            <div
              className={`mt-6 p-4 rounded-lg ${
                result.success
                  ? 'bg-green-500/10 border border-green-500/20 text-green-500'
                  : 'bg-destructive/10 border border-destructive/20 text-destructive'
              }`}
            >
              {result.message}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedSections.size > 0 ? (
                <>
                  <span className="font-medium text-destructive">
                    {selectedSections.size} section(s)
                  </span>{' '}
                  selected ({totalSelected} total records)
                </>
              ) : (
                'No sections selected'
              )}
            </div>

            {!showConfirm ? (
              <Button
                variant="destructive"
                disabled={selectedSections.size === 0}
                onClick={() => setShowConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Reset Selected
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={resetting}
                  onClick={handleReset}
                >
                  {resetting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="mr-2 h-4 w-4" />
                      Confirm Reset
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
