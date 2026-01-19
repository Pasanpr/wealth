'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { CreditCard, FixedExpense, MonthlyCashFlow } from '@/lib/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface CashFlowData {
  year: number
  cards: CreditCard[]
  fixedExpenses: FixedExpense[]
  months: MonthlyCashFlow[]
}

export default function CashFlowGridPage() {
  const [data, setData] = useState<CashFlowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const stickyCellClass = 'sticky left-0 z-20 bg-background shadow-[2px_0_0_0_hsl(var(--border))]'

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/cashflow?year=${selectedYear}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('Failed to fetch cash flow data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedYear])

  const years = []
  const currentYear = new Date().getFullYear()
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(y)
  }

  // Check if a month has any data
  const hasData = (month: MonthlyCashFlow) => {
    return month.totalCredit > 0 || month.checkingBalance > 0
  }

  return (
    <PageContainer
      title="Cash Flow"
      description="Monthly cash flow tracking - credit cards, checking, and payments"
    >
      <div className="flex items-center gap-4 mb-6">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
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

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !data || data.cards.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No credit cards defined. Add credit cards in Settings to start tracking.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted">
                    <th className={`p-2 text-left font-medium min-w-[160px] ${stickyCellClass}`}></th>
                    {MONTHS.map((month, idx) => (
                      <th key={month} className="p-2 text-right font-medium min-w-[100px]">
                        {month} {selectedYear}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Credit Card Balances */}
                  {data.cards.map(card => (
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
                    </tr>
                  ))}

                  {/* Spacer row */}
                  <tr className="h-4"></tr>

                  {/* Checking */}
                  <tr className="border-b bg-muted">
                    <td className={`p-2 font-medium ${stickyCellClass}`}>Checking</td>
                    {data.months.map((month, idx) => (
                      <td key={idx} className="p-2 text-right">
                        {month.checkingBalance > 0
                          ? formatCurrency(month.checkingBalance)
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Transfers */}
                  <tr className="border-b">
                    <td className={`p-2 font-medium ${stickyCellClass}`}>Transfers</td>
                    {data.months.map((month, idx) => (
                      <td key={idx} className="p-2 text-right">
                        {month.transfers > 0
                          ? formatCurrency(month.transfers)
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Spacer row */}
                  <tr className="h-4"></tr>

                  {/* Fixed Expenses */}
                  {data.fixedExpenses.map(expense => (
                    <tr key={expense.id} className="border-b">
                      <td className={`p-2 font-medium ${stickyCellClass}`}>{expense.name}</td>
                      {data.months.map((month, idx) => (
                        <td key={idx} className="p-2 text-right">
                          {expense.amount > 0
                            ? formatCurrency(expense.amount)
                            : <span className="text-muted-foreground">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}

                  {/* Checking Desired End */}
                  <tr className="border-b">
                    <td className={`p-2 font-medium ${stickyCellClass}`}>Checking Desired End</td>
                    {data.months.map((month, idx) => (
                      <td key={idx} className="p-2 text-right">
                        {month.checkingDesiredEnd > 0
                          ? formatCurrency(month.checkingDesiredEnd)
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Available Checking (calculated) */}
                  <tr className="border-b bg-muted">
                    <td className={`p-2 font-medium ${stickyCellClass}`}>Available Checking</td>
                    {data.months.map((month, idx) => (
                      <td key={idx} className={`p-2 text-right font-medium ${month.availableChecking < 0 ? 'text-red-600' : ''}`}>
                        {hasData(month)
                          ? formatCurrency(month.availableChecking)
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Spacer row */}
                  <tr className="h-4"></tr>

                  {/* Total Credit */}
                  <tr className="border-b bg-primary/5">
                    <td className={`p-2 font-bold ${stickyCellClass}`}>{selectedYear} Credit</td>
                    {data.months.map((month, idx) => (
                      <td key={idx} className="p-2 text-right font-bold">
                        {month.totalCredit > 0
                          ? formatCurrency(month.totalCredit)
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Spacer row */}
                  <tr className="h-4"></tr>

                  {/* Checking Payment */}
                  <tr className="border-b">
                    <td className={`p-2 font-medium ${stickyCellClass}`}>Checking Payment</td>
                    {data.months.map((month, idx) => (
                      <td key={idx} className="p-2 text-right">
                        {month.checkingPayment > 0
                          ? formatCurrency(month.checkingPayment)
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>

                  {/* Savings Payment */}
                  <tr className="border-b">
                    <td className={`p-2 font-medium ${stickyCellClass}`}>Savings Payment</td>
                    {data.months.map((month, idx) => (
                      <td key={idx} className="p-2 text-right">
                        {month.savingsPayment > 0
                          ? formatCurrency(month.savingsPayment)
                          : <span className="text-muted-foreground">-</span>}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  )
}
