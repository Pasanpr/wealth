'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { formatCurrency } from '@/lib/utils/format'
import { CreditCard, MonthlyCashFlow } from '@/lib/types'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

interface YearData {
  year: number
  cards: CreditCard[]
  months: MonthlyCashFlow[]
}

export default function SpendingGridPage() {
  const [allYears, setAllYears] = useState<YearData[]>([])
  const [loading, setLoading] = useState(true)
  const stickyCellClass = 'sticky left-0 z-20 bg-background shadow-[2px_0_0_0_hsl(var(--border))]'

  useEffect(() => {
    const fetchAllYears = async () => {
      setLoading(true)
      try {
        // Fetch last 6 years of data
        const currentYear = new Date().getFullYear()
        const years = []
        for (let y = currentYear; y >= currentYear - 5; y--) {
          years.push(y)
        }

        const results = await Promise.all(
          years.map(async year => {
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

    fetchAllYears()
  }, [])

  return (
    <PageContainer
      title="Credit Card Spending"
      description="Monthly credit card balances by card"
    >
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
