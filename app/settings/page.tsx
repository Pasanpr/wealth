'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@/components/ui'
import { Save, Settings2, AlertTriangle, FileText } from 'lucide-react'
import Link from 'next/link'

interface Settings {
  rebalance_threshold: string
  monthly_expense_target: string
  cash_reserve_months: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    rebalance_threshold: '5',
    monthly_expense_target: '5000',
    cash_reserve_months: '6',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const settingsMap: Settings = {
          rebalance_threshold: '5',
          monthly_expense_target: '5000',
          cash_reserve_months: '6',
        }
        data.forEach((s: { key: string; value: string }) => {
          if (s.key in settingsMap) {
            settingsMap[s.key as keyof Settings] = s.value
          }
        })
        setSettings(settingsMap)
      })
      .catch(console.error)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageContainer
      title="Settings"
      description="Configure application settings"
      actions={
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="rebalance_threshold">Rebalance Threshold (%)</Label>
              <Input
                id="rebalance_threshold"
                type="number"
                step="0.1"
                value={settings.rebalance_threshold}
                onChange={e => setSettings({ ...settings, rebalance_threshold: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Trigger rebalancing recommendations when allocation deviates by this percentage
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="monthly_expense_target">Monthly Expense Target ($)</Label>
              <Input
                id="monthly_expense_target"
                type="number"
                step="100"
                value={settings.monthly_expense_target}
                onChange={e => setSettings({ ...settings, monthly_expense_target: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Target monthly spending for budget tracking
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cash_reserve_months">Cash Reserve Target (months)</Label>
              <Input
                id="cash_reserve_months"
                type="number"
                step="1"
                value={settings.cash_reserve_months}
                onChange={e => setSettings({ ...settings, cash_reserve_months: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Target number of months of expenses to keep in cash reserves
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Link
                href="/settings/asset-classes"
                className="flex items-center rounded-md border p-3 hover:bg-accent"
              >
                <Settings2 className="mr-3 h-4 w-4" />
                <div>
                  <span className="text-sm font-medium">Asset Classes</span>
                  <p className="text-xs text-muted-foreground">
                    Configure asset classes and target allocations
                  </p>
                </div>
              </Link>
              <Link
                href="/settings/securities"
                className="flex items-center rounded-md border p-3 hover:bg-accent"
              >
                <Settings2 className="mr-3 h-4 w-4" />
                <div>
                  <span className="text-sm font-medium">Securities</span>
                  <p className="text-xs text-muted-foreground">
                    Manage funds, ETFs, and stocks
                  </p>
                </div>
              </Link>
              <Link
                href="/settings/tax-profile"
                className="flex items-center rounded-md border p-3 hover:bg-accent"
              >
                <Settings2 className="mr-3 h-4 w-4" />
                <div>
                  <span className="text-sm font-medium">Tax Profile</span>
                  <p className="text-xs text-muted-foreground">
                    Set up income and tax rates for RSU calculations
                  </p>
                </div>
              </Link>
              <Link
                href="/settings/w2"
                className="flex items-center rounded-md border p-3 hover:bg-accent"
              >
                <FileText className="mr-3 h-4 w-4" />
                <div>
                  <span className="text-sm font-medium">W-2 Forms</span>
                  <p className="text-xs text-muted-foreground">
                    Enter W-2 wage and tax statements for tax allocation
                  </p>
                </div>
              </Link>
              <Link
                href="/settings/data-management"
                className="flex items-center rounded-md border border-destructive/30 p-3 hover:bg-destructive/5"
              >
                <AlertTriangle className="mr-3 h-4 w-4 text-destructive" />
                <div>
                  <span className="text-sm font-medium">Data Management</span>
                  <p className="text-xs text-muted-foreground">
                    Reset or clear specific data sections
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
