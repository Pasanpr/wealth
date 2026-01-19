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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { CreditCard, CreditCardSpendingWithCard } from '@/lib/types'
import { Save, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function SpendingEntryPage() {
  const [cards, setCards] = useState<CreditCard[]>([])
  const [spending, setSpending] = useState<CreditCardSpendingWithCard[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})

  const fetchData = async () => {
    setLoading(true)
    try {
      const [cardsRes, spendingRes] = await Promise.all([
        fetch('/api/credit-cards'),
        fetch(`/api/spending?year=${year}`),
      ])
      const cardsData = await cardsRes.json()
      const spendingData = await spendingRes.json()

      setCards(cardsData)
      setSpending(spendingData)

      // Initialize values from existing spending data
      const initialValues: Record<string, string> = {}
      spendingData.forEach((s: CreditCardSpendingWithCard) => {
        initialValues[`${s.credit_card_id}-${s.month}`] = s.amount.toString()
      })
      setValues(initialValues)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [year])

  const handleValueChange = (cardId: number, month: number, value: string) => {
    setValues(prev => ({
      ...prev,
      [`${cardId}-${month}`]: value,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const promises: Promise<Response>[] = []

      for (const card of cards) {
        for (let month = 1; month <= 12; month++) {
          const key = `${card.id}-${month}`
          const value = values[key]

          if (value !== undefined && value !== '') {
            promises.push(
              fetch('/api/spending', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  credit_card_id: card.id,
                  year,
                  month,
                  amount: parseFloat(value) || 0,
                }),
              })
            )
          }
        }
      }

      await Promise.all(promises)
      fetchData()
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const getMonthlyTotal = (month: number): number => {
    return cards.reduce((sum, card) => {
      const key = `${card.id}-${month}`
      const value = parseFloat(values[key] || '0')
      return sum + (isNaN(value) ? 0 : value)
    }, 0)
  }

  const getCardTotal = (cardId: number): number => {
    let total = 0
    for (let month = 1; month <= 12; month++) {
      const key = `${cardId}-${month}`
      const value = parseFloat(values[key] || '0')
      total += isNaN(value) ? 0 : value
    }
    return total
  }

  const getGrandTotal = (): number => {
    return cards.reduce((sum, card) => sum + getCardTotal(card.id), 0)
  }

  return (
    <PageContainer
      title="Monthly Spending Entry"
      description="Enter monthly credit card spending totals"
      actions={
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save All'}
        </Button>
      }
    >
      {cards.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No credit cards found. Add credit cards first to enter spending.
            </p>
            <Button asChild>
              <Link href="/spending/cards">Add Credit Cards</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              onClick={() => setYear(y => y - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {year - 1}
            </Button>
            <span className="text-xl font-bold">{year}</span>
            <Button
              variant="outline"
              onClick={() => setYear(y => y + 1)}
            >
              {year + 1}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {loading ? (
            <div className="text-muted-foreground">Loading...</div>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="sticky left-0 bg-muted/50 p-3 text-left font-medium">
                        Month
                      </th>
                      {cards.map(card => (
                        <th key={card.id} className="p-3 text-right font-medium min-w-[120px]">
                          {card.name}
                        </th>
                      ))}
                      <th className="p-3 text-right font-medium min-w-[120px]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map((monthName, index) => {
                      const month = index + 1
                      return (
                        <tr key={month} className="border-b">
                          <td className="sticky left-0 bg-background p-3 font-medium">
                            {monthName}
                          </td>
                          {cards.map(card => {
                            const key = `${card.id}-${month}`
                            return (
                              <td key={card.id} className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="text-right"
                                  value={values[key] || ''}
                                  onChange={e => handleValueChange(card.id, month, e.target.value)}
                                />
                              </td>
                            )
                          })}
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(getMonthlyTotal(month))}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-muted/50 font-bold">
                      <td className="sticky left-0 bg-muted/50 p-3">Year Total</td>
                      {cards.map(card => (
                        <td key={card.id} className="p-3 text-right">
                          {formatCurrency(getCardTotal(card.id))}
                        </td>
                      ))}
                      <td className="p-3 text-right">{formatCurrency(getGrandTotal())}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </PageContainer>
  )
}
