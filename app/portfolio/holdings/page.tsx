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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui'
import { formatCurrency, formatDate, formatShares } from '@/lib/utils/format'
import { HoldingWithDetails, AccountWithType, SecurityWithAssetClass } from '@/lib/types'
import { Plus, PieChart } from 'lucide-react'

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<HoldingWithDetails[]>([])
  const [accounts, setAccounts] = useState<AccountWithType[]>([])
  const [securities, setSecurities] = useState<SecurityWithAssetClass[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    account_id: '',
    security_id: '',
    date: new Date().toISOString().split('T')[0],
    value: '',
    shares: '',
    cost_basis: '',
  })

  const fetchData = async () => {
    try {
      const [holdingsRes, accountsRes, securitiesRes] = await Promise.all([
        fetch('/api/holdings?latest=true'),
        fetch('/api/accounts'),
        fetch('/api/securities'),
      ])
      const holdingsData = await holdingsRes.json()
      const accountsData = await accountsRes.json()
      const securitiesData = await securitiesRes.json()

      setHoldings(holdingsData)
      setAccounts(accountsData)
      setSecurities(securitiesData)
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
      account_id: parseInt(formData.account_id),
      security_id: parseInt(formData.security_id),
      date: formData.date,
      value: parseFloat(formData.value),
      shares: formData.shares ? parseFloat(formData.shares) : null,
      cost_basis: formData.cost_basis ? parseFloat(formData.cost_basis) : null,
    }

    try {
      await fetch('/api/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      console.error('Failed to save holding:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      account_id: '',
      security_id: '',
      date: new Date().toISOString().split('T')[0],
      value: '',
      shares: '',
      cost_basis: '',
    })
  }

  const openNewDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)

  // Group by account
  const holdingsByAccount = holdings.reduce((acc, h) => {
    if (!acc[h.account_name]) {
      acc[h.account_name] = []
    }
    acc[h.account_name].push(h)
    return acc
  }, {} as Record<string, HoldingWithDetails[]>)

  return (
    <PageContainer
      title="Holdings"
      description="Track your investment holdings across all accounts"
      actions={
        <Button onClick={openNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Add Holding
        </Button>
      }
    >
      {/* Summary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Total Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{formatCurrency(totalValue)}</div>
          <p className="text-sm text-muted-foreground mt-1">
            {holdings.length} holdings across {Object.keys(holdingsByAccount).length} accounts
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : holdings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <PieChart className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-muted-foreground">
              No holdings yet. Add securities first, then add holdings.
            </p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(holdingsByAccount).map(([accountName, accountHoldings]) => (
          <Card key={accountName} className="mb-4">
            <CardHeader>
              <CardTitle className="flex justify-between">
                <span>{accountName}</span>
                <span>{formatCurrency(accountHoldings.reduce((sum, h) => sum + h.value, 0))}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Asset Class</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Cost Basis</TableHead>
                    <TableHead>As of</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountHoldings.map(holding => (
                    <TableRow key={holding.id}>
                      <TableCell className="font-medium">{holding.security_symbol}</TableCell>
                      <TableCell>{holding.security_name}</TableCell>
                      <TableCell>{holding.asset_class_name || '-'}</TableCell>
                      <TableCell className="text-right">
                        {holding.shares ? formatShares(holding.shares) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(holding.value)}
                      </TableCell>
                      <TableCell className="text-right">
                        {holding.cost_basis ? formatCurrency(holding.cost_basis) : '-'}
                      </TableCell>
                      <TableCell>{formatDate(holding.date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holding Snapshot</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="account_id">Account</Label>
                <Select
                  value={formData.account_id}
                  onValueChange={value => setFormData({ ...formData, account_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="security_id">Security</Label>
                <Select
                  value={formData.security_id}
                  onValueChange={value => setFormData({ ...formData, security_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select security" />
                  </SelectTrigger>
                  <SelectContent>
                    {securities.map(security => (
                      <SelectItem key={security.id} value={security.id.toString()}>
                        {security.symbol} - {security.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label htmlFor="value">Value ($)</Label>
                <Input
                  id="value"
                  type="number"
                  step="0.01"
                  value={formData.value}
                  onChange={e => setFormData({ ...formData, value: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="shares">Shares (optional)</Label>
                  <Input
                    id="shares"
                    type="number"
                    step="0.0001"
                    value={formData.shares}
                    onChange={e => setFormData({ ...formData, shares: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cost_basis">Cost Basis (optional)</Label>
                  <Input
                    id="cost_basis"
                    type="number"
                    step="0.01"
                    value={formData.cost_basis}
                    onChange={e => setFormData({ ...formData, cost_basis: e.target.value })}
                  />
                </div>
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
