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
} from '@/components/ui'
import { formatCurrency, formatPercent, formatDate, formatShares } from '@/lib/utils/format'
import { RsuVesting, TaxProfile } from '@/lib/types'
import { Calculator, TrendingUp, DollarSign } from 'lucide-react'

interface RsuDecision {
  shares: number
  priceAtVest: number
  grossValue: number
  estimatedTax: number
  netProceeds: number
  effectiveRate: number
}

export default function RsuAdvisorPage() {
  const [taxProfiles, setTaxProfiles] = useState<TaxProfile[]>([])
  const [upcomingVests, setUpcomingVests] = useState<RsuVesting[]>([])
  const [loading, setLoading] = useState(true)

  // Calculator state
  const [shares, setShares] = useState('')
  const [price, setPrice] = useState('')
  const [result, setResult] = useState<RsuDecision | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/tax-profile').then(r => r.json()),
      fetch('/api/rsu').then(r => r.json()),
    ])
      .then(([profiles, vests]) => {
        setTaxProfiles(profiles)
        // Filter to upcoming unvested RSUs
        const today = new Date().toISOString().split('T')[0]
        const upcoming = vests.filter((v: RsuVesting) => !v.is_vested && v.vest_date >= today)
        setUpcomingVests(upcoming)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const latestProfile = taxProfiles[0]

  const handleCalculate = () => {
    if (!shares || !price || !latestProfile) return

    const sharesNum = parseFloat(shares)
    const priceNum = parseFloat(price)
    const grossValue = sharesNum * priceNum
    const estimatedTax = grossValue * latestProfile.effective_rate
    const netProceeds = grossValue - estimatedTax

    setResult({
      shares: sharesNum,
      priceAtVest: priceNum,
      grossValue,
      estimatedTax,
      netProceeds,
      effectiveRate: latestProfile.effective_rate,
    })
  }

  return (
    <PageContainer
      title="RSU Advisor"
      description="Calculate net proceeds and plan RSU decisions"
    >
      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : !latestProfile ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No tax profile found. Add a tax profile in Settings to use the RSU Advisor.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Calculator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Net Proceeds Calculator
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted rounded-lg text-sm">
                Using {latestProfile.year} tax profile (effective rate: {formatPercent(latestProfile.effective_rate)})
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="shares">Number of Shares</Label>
                  <Input
                    id="shares"
                    type="number"
                    step="0.0001"
                    placeholder="100"
                    value={shares}
                    onChange={e => setShares(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="price">Price at Vest ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    placeholder="150.00"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleCalculate} className="w-full">
                Calculate
              </Button>

              {result && (
                <div className="mt-4 space-y-3 p-4 border rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Value:</span>
                    <span className="font-medium">{formatCurrency(result.grossValue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      Est. Tax ({formatPercent(result.effectiveRate)}):
                    </span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(result.estimatedTax)}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-medium">Net Proceeds:</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(result.netProceeds)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Vests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Upcoming Vests
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingVests.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No upcoming vests scheduled.
                </p>
              ) : (
                <div className="space-y-4">
                  {upcomingVests.slice(0, 5).map(vest => {
                    const estimatedGross = vest.shares * vest.grant_price
                    const estimatedNet = estimatedGross * (1 - latestProfile.effective_rate)

                    return (
                      <div key={vest.id} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">{formatDate(vest.vest_date)}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatShares(vest.shares)} shares @ {formatCurrency(vest.grant_price)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-600">
                              ~{formatCurrency(estimatedNet)}
                            </p>
                            <p className="text-xs text-muted-foreground">est. net</p>
                          </div>
                        </div>
                        {vest.grant_id && (
                          <p className="text-xs text-muted-foreground">
                            Grant: {vest.grant_id}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Decision Guide */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>RSU Decision Guide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Sell Immediately</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Lock in guaranteed value</li>
                      <li>Avoid concentration risk</li>
                      <li>Diversify into other investments</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Hold Short-term</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Wait for better price</li>
                      <li>Avoid selling at a low</li>
                      <li>Coordinate with tax planning</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Hold Long-term</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>Strong conviction in company</li>
                      <li>Potential for lower capital gains tax</li>
                      <li>Higher risk tolerance</li>
                    </ul>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Note: This is for informational purposes only and not financial advice.
                  Consult a tax professional for personalized guidance.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  )
}
