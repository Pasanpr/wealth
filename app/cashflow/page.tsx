'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { CreditCard, MonthlyCashFlow } from '@/lib/types'
import { Plus, Save, Check, Pencil, Trash2, CreditCard as CardIcon } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

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
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

interface YearData {
  year: number
  cards: CreditCard[]
  months: MonthlyCashFlow[]
}

interface TrendData {
  year: number
  month: number
  totalCredit: number
  cardBreakdown: { cardId: number; cardName: string; balance: number }[]
}

interface Stats {
  average: number
  median: number
  min: number
  max: number
  total: number
  count: number
}

export default function SpendingPage() {
  const currentDate = new Date()
  const [allYears, setAllYears] = useState<YearData[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('monthly')
  const stickyCellClass = 'sticky left-0 z-20 bg-background shadow-[2px_0_0_0_hsl(var(--border))]'

  // Entry modal state
  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString())
  const [cards, setCards] = useState<CreditCard[]>([])
  const [cardBalances, setCardBalances] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Card management state
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null)
  const [cardFormData, setCardFormData] = useState({
    name: '',
    issuer: '',
    last4: '',
    credit_limit: '',
    display_order: '0',
  })

  // Trends state
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [trendsYear, setTrendsYear] = useState(currentDate.getFullYear().toString())

  const years: number[] = []
  const currentYear = currentDate.getFullYear()
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    years.push(y)
  }

  const fetchAllYears = async () => {
    setLoading(true)
    try {
      const results = await Promise.all(
        years.filter(y => y <= currentYear).map(async year => {
          const res = await fetch(`/api/cashflow?year=${year}`)
          return res.json()
        })
      )

      // Filter to only years with actual data
      const yearsWithData = results.filter(data =>
        data.months?.some((m: MonthlyCashFlow) => m.totalCredit > 0)
      )

      setAllYears(yearsWithData)

      // Set cards from first year with data
      if (results.length > 0 && results[0].cards) {
        setCards(results[0].cards)
      }

      // Build trend data
      const allTrendData: TrendData[] = []
      for (const data of results) {
        if (!data.months) continue
        for (const month of data.months) {
          if (month.totalCredit > 0) {
            allTrendData.push({
              year: data.year,
              month: month.month,
              totalCredit: month.totalCredit,
              cardBreakdown: month.cardBalances,
            })
          }
        }
      }
      allTrendData.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        return a.month - b.month
      })
      setTrendData(allTrendData)

      // Calculate stats for selected year
      updateStats(allTrendData, parseInt(trendsYear))
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateStats = (data: TrendData[], year: number) => {
    const yearData = data.filter(d => d.year === year)
    if (yearData.length > 0) {
      const totals = yearData.map(d => d.totalCredit)
      const sorted = [...totals].sort((a, b) => a - b)
      const sum = totals.reduce((a, b) => a + b, 0)

      setStats({
        average: sum / totals.length,
        median: sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)],
        min: sorted[0],
        max: sorted[sorted.length - 1],
        total: sum,
        count: totals.length,
      })
    } else {
      setStats(null)
    }
  }

  useEffect(() => {
    fetchAllYears()
  }, [])

  useEffect(() => {
    updateStats(trendData, parseInt(trendsYear))
  }, [trendsYear, trendData])

  const fetchMonthData = async () => {
    try {
      const res = await fetch(`/api/cashflow?year=${selectedYear}`)
      const data: YearData = await res.json()

      setCards(data.cards)

      const monthData = data.months.find(m => m.month === parseInt(selectedMonth))
      if (monthData) {
        const balances: Record<number, string> = {}
        monthData.cardBalances.forEach(cb => {
          balances[cb.cardId] = cb.balance > 0 ? cb.balance.toString() : ''
        })
        setCardBalances(balances)
      } else {
        setCardBalances({})
      }
    } catch (error) {
      console.error('Failed to fetch month data:', error)
    }
  }

  const fetchCards = async () => {
    try {
      const res = await fetch('/api/credit-cards')
      const data = await res.json()
      setCards(data)
    } catch (error) {
      console.error('Failed to fetch cards:', error)
    }
  }

  useEffect(() => {
    if (entryModalOpen) {
      fetchMonthData()
      setSaveSuccess(false)
    }
  }, [entryModalOpen, selectedYear, selectedMonth])

  const handleSaveEntry = async () => {
    setSaving(true)
    setSaveSuccess(false)
    try {
      const payload = {
        year: parseInt(selectedYear),
        month: parseInt(selectedMonth),
        cardBalances: cards.map(card => ({
          cardId: card.id,
          balance: parseFloat(cardBalances[card.id] || '0') || 0,
        })),
      }

      await fetch('/api/cashflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setSaveSuccess(true)
      await fetchAllYears()

      setTimeout(() => {
        setEntryModalOpen(false)
        setSaveSuccess(false)
      }, 800)
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const totalCredit = cards.reduce((sum, card) => {
    return sum + (parseFloat(cardBalances[card.id] || '0') || 0)
  }, 0)

  // Card management functions
  const resetCardForm = () => {
    setCardFormData({
      name: '',
      issuer: '',
      last4: '',
      credit_limit: '',
      display_order: '0',
    })
  }

  const handleEditCard = (card: CreditCard) => {
    setEditingCard(card)
    setCardFormData({
      name: card.name,
      issuer: card.issuer || '',
      last4: card.last4 || '',
      credit_limit: card.credit_limit?.toString() || '',
      display_order: card.display_order.toString(),
    })
    setCardDialogOpen(true)
  }

  const handleDeleteCard = async (id: number) => {
    if (!confirm('Are you sure you want to delete this card? This will also delete all spending records for this card.')) return

    try {
      await fetch(`/api/credit-cards/${id}`, { method: 'DELETE' })
      await fetchCards()
      await fetchAllYears()
    } catch (error) {
      console.error('Failed to delete card:', error)
    }
  }

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault()

    const payload = {
      ...cardFormData,
      credit_limit: cardFormData.credit_limit ? parseFloat(cardFormData.credit_limit) : null,
      display_order: parseInt(cardFormData.display_order) || 0,
    }

    try {
      if (editingCard) {
        await fetch(`/api/credit-cards/${editingCard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, is_active: true }),
        })
      } else {
        await fetch('/api/credit-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      setCardDialogOpen(false)
      setEditingCard(null)
      resetCardForm()
      await fetchCards()
      await fetchAllYears()
    } catch (error) {
      console.error('Failed to save card:', error)
    }
  }

  const openNewCardDialog = () => {
    setEditingCard(null)
    resetCardForm()
    setCardDialogOpen(true)
  }

  // Prepare chart data
  const lineChartData = trendData.map(d => ({
    name: `${d.year}-${String(d.month).padStart(2, '0')}`,
    total: d.totalCredit,
  }))

  const yoyData = MONTHS.map((monthName, idx) => {
    const month = idx + 1
    const currentYearData = trendData.find(d => d.year === parseInt(trendsYear) && d.month === month)
    const prevYearData = trendData.find(d => d.year === parseInt(trendsYear) - 1 && d.month === month)

    return {
      name: monthName,
      [parseInt(trendsYear) - 1]: prevYearData?.totalCredit || 0,
      [trendsYear]: currentYearData?.totalCredit || 0,
    }
  })

  const cardChartData = trendData.map(d => {
    const entry: Record<string, number | string> = {
      name: `${d.year}-${String(d.month).padStart(2, '0')}`,
    }
    d.cardBreakdown.forEach(cb => {
      entry[cb.cardName] = cb.balance
    })
    return entry
  })

  return (
    <PageContainer
      title="Spending"
      description="Track and analyze your credit card spending"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between mb-6">
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
          </TabsList>

          {activeTab === 'monthly' && (
            <Button onClick={() => setEntryModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          )}
          {activeTab === 'cards' && (
            <Button onClick={openNewCardDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </Button>
          )}
        </div>

        {/* Monthly Tab */}
        <TabsContent value="monthly">
          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : allYears.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No spending data found. Import credit card data or add entries manually.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {allYears.map(data => (
                <Card key={data.year}>
                  <CardHeader className="pb-3">
                    <CardTitle>{data.year}</CardTitle>
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
                            <th className="p-2 text-right font-medium min-w-[100px] border-l-2">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.cards.map(card => {
                            const yearTotal = data.months.reduce((sum, month) => {
                              const cardBalance = month.cardBalances.find(c => c.cardId === card.id)
                              return sum + (cardBalance?.balance || 0)
                            }, 0)

                            return (
                              <tr key={card.id} className="border-b">
                                <td className={`p-2 font-medium ${stickyCellClass}`}>{card.name}</td>
                                {data.months.map((month, idx) => {
                                  const cardBalance = month.cardBalances.find(c => c.cardId === card.id)
                                  return (
                                    <td key={idx} className="p-2 text-right">
                                      {cardBalance && cardBalance.balance > 0
                                        ? formatCurrency(cardBalance.balance)
                                        : <span className="text-muted-foreground">-</span>}
                                    </td>
                                  )
                                })}
                                <td className="p-2 text-right font-medium border-l-2">
                                  {yearTotal > 0 ? formatCurrency(yearTotal) : <span className="text-muted-foreground">-</span>}
                                </td>
                              </tr>
                            )
                          })}

                          <tr className="border-t-2 bg-muted">
                            <td className={`p-2 font-bold ${stickyCellClass}`}>Total</td>
                            {data.months.map((month, idx) => (
                              <td key={idx} className="p-2 text-right font-bold">
                                {month.totalCredit > 0
                                  ? formatCurrency(month.totalCredit)
                                  : <span className="text-muted-foreground">-</span>}
                              </td>
                            ))}
                            <td className="p-2 text-right font-bold border-l-2">
                              {formatCurrency(data.months.reduce((sum, m) => sum + m.totalCredit, 0))}
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
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends">
          <div className="flex items-center gap-4 mb-6">
            <Select value={trendsYear} onValueChange={setTrendsYear}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.filter(y => y <= currentYear).map(y => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <>
              {stats && (
                <div className="grid gap-4 md:grid-cols-4 mb-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Average</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(stats.average)}</div>
                      <p className="text-xs text-muted-foreground">Per month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Median</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(stats.median)}</div>
                      <p className="text-xs text-muted-foreground">Per month</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Min / Max</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-lg font-bold">
                        {formatCurrency(stats.min)} - {formatCurrency(stats.max)}
                      </div>
                      <p className="text-xs text-muted-foreground">Range</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Year Total</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
                      <p className="text-xs text-muted-foreground">{stats.count} months</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Year over Year Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  {yoyData.some(d => (d[trendsYear] as number) > 0 || (d[parseInt(trendsYear) - 1] as number) > 0) ? (
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={yoyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                          <Legend />
                          <Bar
                            dataKey={parseInt(trendsYear) - 1}
                            fill="hsl(210 40% 80%)"
                            name={`${parseInt(trendsYear) - 1}`}
                          />
                          <Bar
                            dataKey={trendsYear}
                            fill="hsl(222.2 47.4% 11.2%)"
                            name={trendsYear}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No comparison data available.
                    </p>
                  )}
                </CardContent>
              </Card>

              {lineChartData.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle>Total Credit Trend</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lineChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            interval={2}
                          />
                          <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="hsl(222.2 47.4% 11.2%)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {cardChartData.length > 0 && cards.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Per-Card Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={cardChartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 11 }}
                            interval={2}
                          />
                          <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                          <Tooltip formatter={(value) => typeof value === 'number' ? formatCurrency(value) : value} />
                          <Legend />
                          {cards.map((card, idx) => (
                            <Line
                              key={card.id}
                              type="monotone"
                              dataKey={card.name}
                              stroke={COLORS[idx % COLORS.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Cards Tab */}
        <TabsContent value="cards">
          <Card>
            <CardHeader>
              <CardTitle>Your Credit Cards</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : cards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CardIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No credit cards yet. Click &quot;Add Card&quot; to get started.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Issuer</TableHead>
                      <TableHead>Last 4</TableHead>
                      <TableHead className="text-right">Credit Limit</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cards.map(card => (
                      <TableRow key={card.id}>
                        <TableCell className="font-medium">{card.name}</TableCell>
                        <TableCell>{card.issuer || '-'}</TableCell>
                        <TableCell>{card.last4 ? `****${card.last4}` : '-'}</TableCell>
                        <TableCell className="text-right">
                          {card.credit_limit ? formatCurrency(card.credit_limit) : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditCard(card)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteCard(card.id)}
                            >
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
        </TabsContent>
      </Tabs>

      {/* Add Entry Modal */}
      <Dialog open={entryModalOpen} onOpenChange={setEntryModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Monthly Entry</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-4 py-2">
            <div className="flex items-center gap-2">
              <Label>Month:</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[140px]">
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
            <div className="flex items-center gap-2">
              <Label>Year:</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px]">
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

          {cards.length === 0 ? (
            <div className="py-4 text-center text-muted-foreground">
              No credit cards defined. Add credit cards first.
            </div>
          ) : (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {cards.map(card => (
                <div key={card.id} className="grid gap-1.5">
                  <Label htmlFor={`card-${card.id}`}>{card.name}</Label>
                  <Input
                    id={`card-${card.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={cardBalances[card.id] || ''}
                    onChange={e => setCardBalances({ ...cardBalances, [card.id]: e.target.value })}
                  />
                </div>
              ))}
              <div className="pt-3 border-t">
                <div className="flex justify-between font-medium">
                  <span>Total</span>
                  <span>{formatCurrency(totalCredit)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEntry} disabled={saving || cards.length === 0}>
              {saveSuccess ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Saved!
                </>
              ) : saving ? (
                'Saving...'
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card Management Modal */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCard ? 'Edit Credit Card' : 'Add Credit Card'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCard}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="card-name">Card Name</Label>
                <Input
                  id="card-name"
                  placeholder="e.g., Chase Sapphire Reserve"
                  value={cardFormData.name}
                  onChange={e => setCardFormData({ ...cardFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="card-issuer">Issuer</Label>
                <Input
                  id="card-issuer"
                  placeholder="e.g., Chase"
                  value={cardFormData.issuer}
                  onChange={e => setCardFormData({ ...cardFormData, issuer: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="card-last4">Last 4 Digits</Label>
                  <Input
                    id="card-last4"
                    maxLength={4}
                    placeholder="1234"
                    value={cardFormData.last4}
                    onChange={e => setCardFormData({ ...cardFormData, last4: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card-limit">Credit Limit</Label>
                  <Input
                    id="card-limit"
                    type="number"
                    step="0.01"
                    value={cardFormData.credit_limit}
                    onChange={e => setCardFormData({ ...cardFormData, credit_limit: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="card-order">Display Order</Label>
                <Input
                  id="card-order"
                  type="number"
                  value={cardFormData.display_order}
                  onChange={e => setCardFormData({ ...cardFormData, display_order: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCardDialogOpen(false)}>
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
