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
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { CreditCard, MonthlyCashFlow } from '@/lib/types'
import { Plus, Save, Check } from 'lucide-react'

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

interface YearData {
  year: number
  cards: CreditCard[]
  months: MonthlyCashFlow[]
}

export default function SpendingGridPage() {
  const currentDate = new Date()
  const [allYears, setAllYears] = useState<YearData[]>([])
  const [loading, setLoading] = useState(true)
  const stickyCellClass = 'sticky left-0 z-20 bg-background shadow-[2px_0_0_0_hsl(var(--border))]'

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState((currentDate.getMonth() + 1).toString())
  const [cards, setCards] = useState<CreditCard[]>([])
  const [cardBalances, setCardBalances] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

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
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllYears()
  }, [])

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

  useEffect(() => {
    if (modalOpen) {
      fetchMonthData()
      setSaveSuccess(false)
    }
  }, [modalOpen, selectedYear, selectedMonth])

  const handleSave = async () => {
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

      // Close modal after short delay to show success
      setTimeout(() => {
        setModalOpen(false)
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

  return (
    <PageContainer
      title="Credit Card Spending"
      description="Monthly credit card balances by card"
      actions={
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Entry
        </Button>
      }
    >
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
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
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || cards.length === 0}>
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

                      {/* Total row */}
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
    </PageContainer>
  )
}
