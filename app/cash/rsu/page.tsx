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
import { formatCurrency, formatDate, formatShares, formatPercent } from '@/lib/utils/format'
import { RsuVesting, RsuMetrics } from '@/lib/types'
import { Plus, Pencil, Trash2, DollarSign, Percent, TrendingUp, PiggyBank, Clock, CheckCircle, Upload, RefreshCw, TrendingDown } from 'lucide-react'
import Link from 'next/link'

interface StockPriceData {
  symbol: string
  price: number
  previousClose?: number
  change?: number
  changePercent?: number
  cached?: boolean
  fetchedAt?: string
  error?: string
}

interface RsuData {
  metrics: RsuMetrics
  historicalTaxRates: { year: number; rate: number; vestValue: number; taxesWithheld: number }[]
  reinvestmentSummary: { year: number; netProceeds: number; reinvested: number; cashRetained: number; rate: number }[]
}

export default function RsuPage() {
  const [records, setRecords] = useState<RsuVesting[]>([])
  const [metricsData, setMetricsData] = useState<RsuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<RsuVesting | null>(null)
  const [stockPrice, setStockPrice] = useState('')
  const [livePrice, setLivePrice] = useState<StockPriceData | null>(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'vested' | 'pending'>('vested')
  const [formData, setFormData] = useState({
    // Grant info
    grant_date: '',
    grant_id: '',
    grant_price: '',
    // Vesting info
    vest_date: '',
    shares: '',
    is_vested: false,
    actual_price_at_vest: '',
    // Sale info
    sale_date: '',
    sale_price: '',
    gross_proceeds: '',
    taxes_withheld: '',
    net_proceeds: '',
    reinvested_amount: '',
    cash_retained: '',
  })

  const fetchRecords = async () => {
    try {
      const res = await fetch('/api/rsu')
      const data = await res.json()
      setRecords(data)
    } catch (error) {
      console.error('Failed to fetch records:', error)
    }
  }

  const fetchMetrics = async () => {
    try {
      const url = stockPrice ? `/api/rsu/metrics?stockPrice=${stockPrice}` : '/api/rsu/metrics'
      const res = await fetch(url)
      const data = await res.json()
      setMetricsData(data)
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
    }
  }

  const fetchStockPrice = async () => {
    setPriceLoading(true)
    try {
      const res = await fetch('/api/stock-price?symbol=INTU')
      const data = await res.json()
      if (data.error) {
        setLivePrice({ symbol: 'INTU', price: 0, error: data.message })
      } else {
        setLivePrice(data)
        // Auto-set the stock price for calculations
        setStockPrice(data.price.toFixed(2))
      }
    } catch (error) {
      console.error('Failed to fetch stock price:', error)
      setLivePrice({ symbol: 'INTU', price: 0, error: 'Failed to fetch' })
    } finally {
      setPriceLoading(false)
    }
  }

  useEffect(() => {
    Promise.all([fetchRecords(), fetchMetrics(), fetchStockPrice()]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (stockPrice) {
      fetchMetrics()
    }
  }, [stockPrice])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      grant_date: formData.grant_date,
      grant_id: formData.grant_id || null,
      grant_price: parseFloat(formData.grant_price),
      vest_date: formData.vest_date,
      shares: parseFloat(formData.shares),
      is_vested: formData.is_vested,
      actual_price_at_vest: formData.actual_price_at_vest ? parseFloat(formData.actual_price_at_vest) : null,
      sale_date: formData.sale_date || null,
      sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
      gross_proceeds: formData.gross_proceeds ? parseFloat(formData.gross_proceeds) : null,
      taxes_withheld: formData.taxes_withheld ? parseFloat(formData.taxes_withheld) : null,
      net_proceeds: formData.net_proceeds ? parseFloat(formData.net_proceeds) : null,
      reinvested_amount: formData.reinvested_amount ? parseFloat(formData.reinvested_amount) : null,
      cash_retained: formData.cash_retained ? parseFloat(formData.cash_retained) : null,
    }

    try {
      if (editingRecord) {
        await fetch(`/api/rsu/${editingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        await fetch('/api/rsu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setDialogOpen(false)
      setEditingRecord(null)
      resetForm()
      fetchRecords()
      fetchMetrics()
    } catch (error) {
      console.error('Failed to save record:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      grant_date: '',
      grant_id: '',
      grant_price: '',
      vest_date: '',
      shares: '',
      is_vested: false,
      actual_price_at_vest: '',
      sale_date: '',
      sale_price: '',
      gross_proceeds: '',
      taxes_withheld: '',
      net_proceeds: '',
      reinvested_amount: '',
      cash_retained: '',
    })
  }

  const handleEdit = (record: RsuVesting) => {
    setEditingRecord(record)
    setFormData({
      grant_date: record.grant_date,
      grant_id: record.grant_id || '',
      grant_price: record.grant_price.toString(),
      vest_date: record.vest_date,
      shares: record.shares.toString(),
      is_vested: Boolean(record.is_vested),
      actual_price_at_vest: record.actual_price_at_vest?.toString() || '',
      sale_date: record.sale_date || '',
      sale_price: record.sale_price?.toString() || '',
      gross_proceeds: record.gross_proceeds?.toString() || '',
      taxes_withheld: record.taxes_withheld?.toString() || '',
      net_proceeds: record.net_proceeds?.toString() || '',
      reinvested_amount: record.reinvested_amount?.toString() || '',
      cash_retained: record.cash_retained?.toString() || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this record?')) return

    try {
      await fetch(`/api/rsu/${id}`, { method: 'DELETE' })
      fetchRecords()
      fetchMetrics()
    } catch (error) {
      console.error('Failed to delete record:', error)
    }
  }

  const openNewDialog = () => {
    setEditingRecord(null)
    resetForm()
    setDialogOpen(true)
  }

  // Auto-calculate gross proceeds when shares and sale price change
  const handleSaleInputChange = (field: string, value: string) => {
    const updated = { ...formData, [field]: value }

    // Auto-calculate gross proceeds
    if (field === 'shares' || field === 'sale_price') {
      const shares = parseFloat(field === 'shares' ? value : formData.shares)
      const salePrice = parseFloat(field === 'sale_price' ? value : formData.sale_price)
      if (!isNaN(shares) && !isNaN(salePrice)) {
        updated.gross_proceeds = (shares * salePrice).toFixed(2)
      }
    }

    // Auto-calculate net proceeds
    if (field === 'gross_proceeds' || field === 'taxes_withheld') {
      const gross = parseFloat(field === 'gross_proceeds' ? value : updated.gross_proceeds)
      const taxes = parseFloat(field === 'taxes_withheld' ? value : formData.taxes_withheld)
      if (!isNaN(gross) && !isNaN(taxes)) {
        updated.net_proceeds = (gross - taxes).toFixed(2)
      }
    }

    setFormData(updated)
  }

  const vestedRecords = records.filter(r => r.is_vested)
  const pendingRecords = records.filter(r => !r.is_vested)
  const metrics = metricsData?.metrics

  return (
    <PageContainer
      title="RSU Tracking"
      description="Track your RSU vesting, sales, and tax impact"
      actions={
        <div className="flex gap-2">
          <Link href="/import">
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </Link>
          <Button onClick={openNewDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Add RSU
          </Button>
        </div>
      }
    >
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">YTD RSU Income</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? formatCurrency(metrics.ytdVestValue) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">Total vested value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Effective Tax Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? formatPercent(metrics.effectiveTaxRate) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics ? formatCurrency(metrics.ytdTaxesWithheld) : '--'} withheld
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Projected Income</CardTitle>
            {livePrice && typeof livePrice.change === 'number' && livePrice.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.annualProjectedGross ? formatCurrency(metrics.annualProjectedGross) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">gross projection</p>

            {metrics?.annualProjectedNet !== null && metrics?.annualProjectedNet !== undefined ? (
              <div className="mt-2">
                <div className="text-lg font-semibold text-green-600">
                  {formatCurrency(metrics.annualProjectedNet)}
                </div>
                <p className="text-xs text-muted-foreground">
                  after tax ({metrics.taxRateYear} rate: {formatPercent(metrics.taxRateUsed || 0)})
                </p>
              </div>
            ) : (
              <div className="mt-2">
                <Link href="/settings" className="text-xs text-blue-600 hover:underline">
                  Add tax profile for net projection
                </Link>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3 pt-2 border-t">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium">INTU:</span>
                {priceLoading ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : livePrice?.error ? (
                  <span className="text-xs text-destructive">Error</span>
                ) : livePrice ? (
                  <>
                    <span className="text-xs font-semibold">${livePrice.price.toFixed(2)}</span>
                    {typeof livePrice.changePercent === 'number' && (
                      <span className={`text-xs ${livePrice.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ({livePrice.changePercent >= 0 ? '+' : ''}{livePrice.changePercent.toFixed(2)}%)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">--</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={fetchStockPrice}
                  disabled={priceLoading}
                >
                  <RefreshCw className={`h-3 w-3 ${priceLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics ? formatShares(metrics.remainingYearShares) : '--'} shares remaining this year
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reinvestment Rate</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics ? formatPercent(metrics.reinvestmentRate) : '--'}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics ? formatCurrency(metrics.totalReinvested) : '--'} reinvested YTD
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <Button
          variant={activeTab === 'vested' ? 'default' : 'outline'}
          onClick={() => setActiveTab('vested')}
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Vested/Sold ({vestedRecords.length})
        </Button>
        <Button
          variant={activeTab === 'pending' ? 'default' : 'outline'}
          onClick={() => setActiveTab('pending')}
        >
          <Clock className="mr-2 h-4 w-4" />
          Upcoming ({pendingRecords.length})
        </Button>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === 'vested' ? 'Vested & Sold RSUs' : 'Upcoming Vests'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (activeTab === 'vested' ? vestedRecords : pendingRecords).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {activeTab === 'vested'
                ? 'No vested RSU records yet. Add your historical vest data.'
                : 'No upcoming vests scheduled.'}
            </div>
          ) : activeTab === 'vested' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vest Date</TableHead>
                  <TableHead>Grant ID</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Vest Price</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Taxes</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">Reinvested</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vestedRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.vest_date)}</TableCell>
                    <TableCell>{record.grant_id || '-'}</TableCell>
                    <TableCell className="text-right">{formatShares(record.shares)}</TableCell>
                    <TableCell className="text-right">
                      {record.actual_price_at_vest ? formatCurrency(record.actual_price_at_vest) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.gross_proceeds ? formatCurrency(record.gross_proceeds) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.taxes_withheld ? formatCurrency(record.taxes_withheld) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.net_proceeds ? formatCurrency(record.net_proceeds) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {record.reinvested_amount ? formatCurrency(record.reinvested_amount) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vest Date</TableHead>
                  <TableHead>Grant ID</TableHead>
                  <TableHead>Grant Date</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Grant Price</TableHead>
                  <TableHead className="text-right">Est. Value</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRecords.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.vest_date)}</TableCell>
                    <TableCell>{record.grant_id || '-'}</TableCell>
                    <TableCell>{formatDate(record.grant_date)}</TableCell>
                    <TableCell className="text-right">{formatShares(record.shares)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(record.grant_price)}</TableCell>
                    <TableCell className="text-right">
                      {stockPrice
                        ? formatCurrency(record.shares * parseFloat(stockPrice))
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(record)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? 'Edit RSU Record' : 'Add RSU Record'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {/* Grant Info Section */}
              <div className="text-sm font-medium text-muted-foreground">Grant Information</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="grant_date">Grant Date</Label>
                  <Input
                    id="grant_date"
                    type="date"
                    value={formData.grant_date}
                    onChange={e => setFormData({ ...formData, grant_date: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grant_id">Grant ID</Label>
                  <Input
                    id="grant_id"
                    value={formData.grant_id}
                    onChange={e => setFormData({ ...formData, grant_id: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grant_price">Grant Price</Label>
                  <Input
                    id="grant_price"
                    type="number"
                    step="0.01"
                    value={formData.grant_price}
                    onChange={e => setFormData({ ...formData, grant_price: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Vesting Info Section */}
              <div className="text-sm font-medium text-muted-foreground mt-4">Vesting Information</div>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="vest_date">Vest Date</Label>
                  <Input
                    id="vest_date"
                    type="date"
                    value={formData.vest_date}
                    onChange={e => setFormData({ ...formData, vest_date: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="shares">Shares</Label>
                  <Input
                    id="shares"
                    type="number"
                    step="0.0001"
                    value={formData.shares}
                    onChange={e => handleSaleInputChange('shares', e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="actual_price_at_vest">Vest Price (FMV)</Label>
                  <Input
                    id="actual_price_at_vest"
                    type="number"
                    step="0.01"
                    value={formData.actual_price_at_vest}
                    onChange={e => setFormData({ ...formData, actual_price_at_vest: e.target.value })}
                    placeholder="Price at vesting"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_vested"
                  checked={formData.is_vested}
                  onChange={e => setFormData({ ...formData, is_vested: e.target.checked })}
                />
                <Label htmlFor="is_vested">Vested (shares have been released)</Label>
              </div>

              {/* Sale Info Section - only shown when vested */}
              {formData.is_vested && (
                <>
                  <div className="text-sm font-medium text-muted-foreground mt-4">Sale Information</div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sale_date">Sale Date</Label>
                      <Input
                        id="sale_date"
                        type="date"
                        value={formData.sale_date}
                        onChange={e => setFormData({ ...formData, sale_date: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sale_price">Sale Price</Label>
                      <Input
                        id="sale_price"
                        type="number"
                        step="0.01"
                        value={formData.sale_price}
                        onChange={e => handleSaleInputChange('sale_price', e.target.value)}
                        placeholder="Per share"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="gross_proceeds">Gross Proceeds</Label>
                      <Input
                        id="gross_proceeds"
                        type="number"
                        step="0.01"
                        value={formData.gross_proceeds}
                        onChange={e => handleSaleInputChange('gross_proceeds', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="taxes_withheld">Taxes Withheld</Label>
                      <Input
                        id="taxes_withheld"
                        type="number"
                        step="0.01"
                        value={formData.taxes_withheld}
                        onChange={e => handleSaleInputChange('taxes_withheld', e.target.value)}
                        placeholder="Broker withheld"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="net_proceeds">Net Proceeds</Label>
                      <Input
                        id="net_proceeds"
                        type="number"
                        step="0.01"
                        value={formData.net_proceeds}
                        onChange={e => setFormData({ ...formData, net_proceeds: e.target.value })}
                      />
                    </div>
                    <div />
                  </div>

                  <div className="text-sm font-medium text-muted-foreground mt-4">Distribution</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="reinvested_amount">Reinvested Amount</Label>
                      <Input
                        id="reinvested_amount"
                        type="number"
                        step="0.01"
                        value={formData.reinvested_amount}
                        onChange={e => setFormData({ ...formData, reinvested_amount: e.target.value })}
                        placeholder="Into other investments"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="cash_retained">Cash Retained</Label>
                      <Input
                        id="cash_retained"
                        type="number"
                        step="0.01"
                        value={formData.cash_retained}
                        onChange={e => setFormData({ ...formData, cash_retained: e.target.value })}
                        placeholder="Kept as cash"
                      />
                    </div>
                  </div>
                </>
              )}
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
