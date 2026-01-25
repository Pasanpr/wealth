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
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { CreditCard, MonthlyCashFlow } from '@/lib/types'
import { Save } from 'lucide-react'

const MONTHS = [
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

interface CashFlowData {
  year: number
  cards: CreditCard[]
  months: MonthlyCashFlow[]
}

export default function CashFlowEntryPage() {
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear().toString())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1 + '')

  const [cards, setCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [cardBalances, setCardBalances] = useState<Record<number, string>>({})

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cashflow?year=${selectedYear}`)
      const data: CashFlowData = await res.json()

      setCards(data.cards)

      // Load existing data for selected month
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
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear, selectedMonth])

  const handleSave = async () => {
    setSaving(true)
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

      // Refresh to confirm save
      fetchData()
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  // Calculate total
  const totalCredit = cards.reduce((sum, card) => {
    return sum + (parseFloat(cardBalances[card.id] || '0') || 0)
  }, 0)

  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear + 1; y >= currentYear - 5; y--) {
    years.push(y)
  }

  return (
    <PageContainer
      title="Monthly Entry"
      description="Enter credit card balances for a specific month"
      actions={
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      }
    >
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Label>Month:</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
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

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : cards.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No credit cards defined. Add credit cards first.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Credit Card Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {cards.map(card => (
                <div key={card.id} className="grid gap-2">
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
              <div className="pt-4 border-t">
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(totalCredit)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
