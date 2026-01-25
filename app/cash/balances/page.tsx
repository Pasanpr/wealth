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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { CashAccount } from '@/lib/types'
import { Plus, Save } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

interface MonthData {
  year: number
  month: number
  accountBalances: { accountId: number; accountName: string; balance: number }[]
  totalCash: number
}

interface YearData {
  year: number
  months: MonthData[]
}

interface CashData {
  accounts: CashAccount[]
  years: YearData[]
}

export default function CashBalancesPage() {
  const [data, setData] = useState<CashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accountDialogOpen, setAccountDialogOpen] = useState(false)
  const [entryDialogOpen, setEntryDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newAccount, setNewAccount] = useState({ name: '', account_type: 'checking', institution: '' })

  const currentDate = new Date()
  const [entryYear, setEntryYear] = useState(currentDate.getFullYear().toString())
  const [entryMonth, setEntryMonth] = useState((currentDate.getMonth() + 1).toString())
  const [entryBalances, setEntryBalances] = useState<Record<number, string>>({})

  const stickyCellClass = 'sticky left-0 z-20 bg-background shadow-[2px_0_0_0_hsl(var(--border))]'

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/monthly-cash')
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await fetch('/api/cash-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      })
      setAccountDialogOpen(false)
      setNewAccount({ name: '', account_type: 'checking', institution: '' })
      fetchData()
    } catch (error) {
      console.error('Failed to add account:', error)
    }
  }

  const openEntryDialog = () => {
    // Pre-populate with existing data for selected month
    const year = parseInt(entryYear)
    const month = parseInt(entryMonth)
    const yearData = data?.years.find(y => y.year === year)
    const monthData = yearData?.months.find(m => m.month === month)

    const balances: Record<number, string> = {}
    if (monthData) {
      monthData.accountBalances.forEach(ab => {
        balances[ab.accountId] = ab.balance > 0 ? ab.balance.toString() : ''
      })
    }
    setEntryBalances(balances)
    setEntryDialogOpen(true)
  }

  const handleSaveEntry = async () => {
    setSaving(true)
    try {
      const payload = {
        year: parseInt(entryYear),
        month: parseInt(entryMonth),
        accountBalances: data?.accounts.map(account => ({
          accountId: account.id,
          balance: parseFloat(entryBalances[account.id] || '0') || 0,
        })) || [],
      }

      await fetch('/api/monthly-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setEntryDialogOpen(false)
      fetchData()
    } catch (error) {
      console.error('Failed to save entry:', error)
    } finally {
      setSaving(false)
    }
  }

  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    years.push(y)
  }

  // Filter to only years with data
  const yearsWithData = data?.years.filter(y =>
    y.months.some(m => m.totalCash > 0)
  ) || []

  return (
    <PageContainer
      title="Cash Balances"
      description="End-of-month cash balances by account"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAccountDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Account
          </Button>
          <Button onClick={openEntryDialog} disabled={!data?.accounts.length}>
            <Save className="mr-2 h-4 w-4" />
            Enter Balances
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !data?.accounts.length ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No cash accounts defined. Click &quot;Add Account&quot; to get started.
          </CardContent>
        </Card>
      ) : yearsWithData.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No balance data yet. Click &quot;Enter Balances&quot; to add monthly balances.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {yearsWithData.map(yearData => (
            <Card key={yearData.year}>
              <CardHeader className="pb-3">
                <CardTitle>{yearData.year}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-muted">
                        <th className={`p-2 text-left font-medium min-w-[140px] ${stickyCellClass}`}></th>
                        {MONTHS.map(month => (
                          <th key={month} className="p-2 text-right font-medium min-w-[90px]">
                            {month}
                          </th>
                        ))}
                        <th className="p-2 text-right font-medium min-w-[100px] border-l-2">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.accounts.map(account => {
                        const monthsWithData = yearData.months.filter(m => {
                          const ab = m.accountBalances.find(a => a.accountId === account.id)
                          return ab && ab.balance > 0
                        })
                        const avgBalance = monthsWithData.length > 0
                          ? monthsWithData.reduce((sum, m) => {
                              const ab = m.accountBalances.find(a => a.accountId === account.id)
                              return sum + (ab?.balance || 0)
                            }, 0) / monthsWithData.length
                          : 0

                        return (
                          <tr key={account.id} className="border-b">
                            <td className={`p-2 font-medium ${stickyCellClass}`}>{account.name}</td>
                            {yearData.months.map((month, idx) => {
                              const ab = month.accountBalances.find(a => a.accountId === account.id)
                              return (
                                <td key={idx} className="p-2 text-right">
                                  {ab && ab.balance > 0
                                    ? formatCurrency(ab.balance)
                                    : <span className="text-muted-foreground">-</span>}
                                </td>
                              )
                            })}
                            <td className="p-2 text-right font-medium border-l-2">
                              {avgBalance > 0 ? formatCurrency(avgBalance) : <span className="text-muted-foreground">-</span>}
                            </td>
                          </tr>
                        )
                      })}

                      {/* Total row */}
                      <tr className="border-t-2 bg-muted">
                        <td className={`p-2 font-bold ${stickyCellClass}`}>Total</td>
                        {yearData.months.map((month, idx) => (
                          <td key={idx} className="p-2 text-right font-bold">
                            {month.totalCash > 0
                              ? formatCurrency(month.totalCash)
                              : <span className="text-muted-foreground">-</span>}
                          </td>
                        ))}
                        <td className="p-2 text-right font-bold border-l-2">
                          {(() => {
                            const monthsWithData = yearData.months.filter(m => m.totalCash > 0)
                            const avg = monthsWithData.length > 0
                              ? monthsWithData.reduce((sum, m) => sum + m.totalCash, 0) / monthsWithData.length
                              : 0
                            return avg > 0 ? formatCurrency(avg) : <span className="text-muted-foreground">-</span>
                          })()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cash Account</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddAccount}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Account Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Chase Checking"
                  value={newAccount.name}
                  onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Account Type</Label>
                <Select
                  value={newAccount.account_type}
                  onValueChange={value => setNewAccount({ ...newAccount, account_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Checking</SelectItem>
                    <SelectItem value="savings">Savings</SelectItem>
                    <SelectItem value="money_market">Money Market</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="institution">Institution (Optional)</Label>
                <Input
                  id="institution"
                  placeholder="e.g., Chase"
                  value={newAccount.institution}
                  onChange={e => setNewAccount({ ...newAccount, institution: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Account</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Entry Dialog */}
      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enter Monthly Balances</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Month</Label>
                <Select value={entryMonth} onValueChange={setEntryMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map(m => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Year</Label>
                <Select value={entryYear} onValueChange={setEntryYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y.toString()}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              {data?.accounts.map(account => (
                <div key={account.id} className="grid gap-2">
                  <Label htmlFor={`bal-${account.id}`}>{account.name}</Label>
                  <Input
                    id={`bal-${account.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={entryBalances[account.id] || ''}
                    onChange={e => setEntryBalances({ ...entryBalances, [account.id]: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>
                  {formatCurrency(
                    Object.values(entryBalances).reduce((sum, val) => sum + (parseFloat(val) || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEntryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEntry} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
