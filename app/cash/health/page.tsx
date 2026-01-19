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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils/format'
import { CashBalance } from '@/lib/types'
import { Plus, Trash2, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react'

interface CashHealthData {
  health: {
    totalCash: number
    monthlyExpenseAverage: number
    monthsCovered: number
    targetMonths: number
    status: 'healthy' | 'warning' | 'critical'
  }
  coverage: { months: number; amount: number; coverage: number }[]
}

export default function CashHealthPage() {
  const [healthData, setHealthData] = useState<CashHealthData | null>(null)
  const [balances, setBalances] = useState<CashBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    balance: '',
    account_name: '',
    notes: '',
  })

  const fetchData = async () => {
    try {
      const [healthRes, balancesRes] = await Promise.all([
        fetch('/api/cash-health'),
        fetch('/api/cash-balances'),
      ])
      const health = await healthRes.json()
      const balanceData = await balancesRes.json()
      setHealthData(health)
      setBalances(balanceData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      ...formData,
      balance: parseFloat(formData.balance),
    }

    try {
      await fetch('/api/cash-balances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setDialogOpen(false)
      setFormData({
        date: new Date().toISOString().split('T')[0],
        balance: '',
        account_name: '',
        notes: '',
      })
      fetchData()
    } catch (error) {
      console.error('Failed to save balance:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-8 w-8 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-8 w-8 text-yellow-600" />
      case 'critical':
        return <AlertCircle className="h-8 w-8 text-red-600" />
      default:
        return null
    }
  }

  const getStatusMessage = (status: string, monthsCovered: number, targetMonths: number) => {
    switch (status) {
      case 'healthy':
        return `You have ${formatNumber(monthsCovered, 1)} months of expenses covered, exceeding your ${targetMonths} month target.`
      case 'warning':
        return `You have ${formatNumber(monthsCovered, 1)} months of expenses covered, below your ${targetMonths} month target.`
      case 'critical':
        return `You only have ${formatNumber(monthsCovered, 1)} months of expenses covered. Consider building your cash reserves.`
      default:
        return ''
    }
  }

  // Group balances by account
  const accountBalances = balances.reduce((acc, balance) => {
    if (!acc[balance.account_name]) {
      acc[balance.account_name] = []
    }
    acc[balance.account_name].push(balance)
    return acc
  }, {} as Record<string, CashBalance[]>)

  // Get latest balance per account
  const latestByAccount = Object.entries(accountBalances).map(([name, records]) => ({
    name,
    balance: records[0].balance,
    date: records[0].date,
  }))

  return (
    <PageContainer
      title="Cash Health Analysis"
      description="Monitor your cash reserves and expense coverage"
      actions={
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Balance
        </Button>
      }
    >
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : (
        <>
          {/* Status Card */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                {healthData && getStatusIcon(healthData.health.status)}
                <div>
                  <h3 className="text-xl font-semibold capitalize mb-1">
                    {healthData?.health.status || 'Unknown'} Status
                  </h3>
                  <p className="text-muted-foreground">
                    {healthData && getStatusMessage(
                      healthData.health.status,
                      healthData.health.monthsCovered,
                      healthData.health.targetMonths
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Cash</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData ? formatCurrency(healthData.health.totalCash) : '--'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData ? formatCurrency(healthData.health.monthlyExpenseAverage) : '--'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Months Covered</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {healthData ? formatNumber(healthData.health.monthsCovered, 1) : '--'}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coverage Bars */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Expense Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              {healthData?.coverage && healthData.coverage.length > 0 ? (
                <div className="space-y-6">
                  {healthData.coverage.map(item => (
                    <div key={item.months}>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">
                          {item.months} Month{item.months > 1 ? 's' : ''}
                        </span>
                        <span className={item.coverage >= 1 ? 'text-green-600' : 'text-yellow-600'}>
                          {item.coverage >= 1
                            ? `Covered (${formatNumber(item.coverage * 100, 0)}%)`
                            : `${formatNumber(item.coverage * 100, 0)}% covered`}
                        </span>
                      </div>
                      <div className="h-4 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            item.coverage >= 1 ? 'bg-green-600' : 'bg-yellow-600'
                          }`}
                          style={{ width: `${Math.min(item.coverage * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Required: {formatCurrency(item.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Add cash balances and yearly expenses to see coverage analysis.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Account Balances */}
          <Card>
            <CardHeader>
              <CardTitle>Cash Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              {latestByAccount.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No cash balances recorded yet. Click &quot;Add Balance&quot; to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestByAccount.map(account => (
                      <TableRow key={account.name}>
                        <TableCell className="font-medium">{account.name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(account.balance)}</TableCell>
                        <TableCell>{formatDate(account.date)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(latestByAccount.reduce((sum, a) => sum + a.balance, 0))}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cash Balance</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  placeholder="e.g., Checking, Savings, Emergency Fund"
                  value={formData.account_name}
                  onChange={e => setFormData({ ...formData, account_name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="balance">Balance</Label>
                <Input
                  id="balance"
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={e => setFormData({ ...formData, balance: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
