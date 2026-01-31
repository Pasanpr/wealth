import { getDb } from '@/lib/db'
import { RsuVesting, RsuMetrics, TaxProfile } from '@/lib/types'

/**
 * Get all RSU records
 */
export function getRsuRecords(): RsuVesting[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM rsu_vesting_schedule
    ORDER BY vest_date DESC
  `).all() as RsuVesting[]
}

/**
 * Calculate RSU metrics for dashboard
 */
export function getRsuMetrics(currentStockPrice?: number): RsuMetrics {
  const db = getDb()
  const currentYear = new Date().getFullYear()

  // Get all RSU records
  const records = db.prepare(`
    SELECT * FROM rsu_vesting_schedule
  `).all() as RsuVesting[]

  // YTD vested records (with vest_price/actual_price_at_vest)
  const ytdVested = records.filter(r => {
    const vestYear = new Date(r.vest_date).getFullYear()
    return r.is_vested && vestYear === currentYear && r.actual_price_at_vest
  })

  // YTD vest value (shares × vest price)
  const ytdVestValue = ytdVested.reduce(
    (sum, r) => sum + r.shares * (r.actual_price_at_vest || 0),
    0
  )

  // YTD taxes withheld
  const ytdTaxesWithheld = ytdVested.reduce(
    (sum, r) => sum + (r.taxes_withheld || 0),
    0
  )

  // Effective tax rate
  const effectiveTaxRate = ytdVestValue > 0 ? ytdTaxesWithheld / ytdVestValue : 0

  // YTD reinvested
  const totalReinvested = ytdVested.reduce(
    (sum, r) => sum + (r.reinvested_amount || 0),
    0
  )

  // YTD net proceeds (for reinvestment rate)
  const ytdNetProceeds = ytdVested.reduce(
    (sum, r) => sum + (r.net_proceeds || 0),
    0
  )

  // Reinvestment rate
  const reinvestmentRate = ytdNetProceeds > 0 ? totalReinvested / ytdNetProceeds : 0

  // Pending shares (unvested)
  const pendingShares = records
    .filter(r => !r.is_vested)
    .reduce((sum, r) => sum + r.shares, 0)

  // Vested shares (all time)
  const vestedShares = records
    .filter(r => r.is_vested)
    .reduce((sum, r) => sum + r.shares, 0)

  // Projected income from future vests (if current stock price provided)
  const projectedIncome = currentStockPrice
    ? pendingShares * currentStockPrice
    : 0

  // Remaining vests for current year (unvested shares with vest date this year)
  const remainingThisYear = records.filter(r => {
    const vestYear = new Date(r.vest_date).getFullYear()
    return !r.is_vested && vestYear === currentYear
  })

  const remainingYearShares = remainingThisYear.reduce(
    (sum, r) => sum + r.shares,
    0
  )

  // Remaining projected value for current year (using current stock price)
  const remainingYearGross = currentStockPrice
    ? remainingYearShares * currentStockPrice
    : 0

  // Annual gross = YTD actual + remaining projected
  const annualProjectedGross = ytdVestValue + remainingYearGross

  // Get most recent tax profile for net calculation
  const taxProfile = db.prepare(
    'SELECT * FROM tax_profile ORDER BY year DESC LIMIT 1'
  ).get() as TaxProfile | undefined

  // Calculate net if tax profile exists
  const annualProjectedNet = taxProfile
    ? annualProjectedGross * (1 - taxProfile.effective_rate)
    : null

  return {
    ytdVestValue,
    ytdTaxesWithheld,
    effectiveTaxRate,
    totalReinvested,
    reinvestmentRate,
    projectedIncome,
    pendingShares,
    vestedShares,
    annualProjectedGross,
    annualProjectedNet,
    remainingYearGross,
    remainingYearShares,
    taxRateUsed: taxProfile?.effective_rate ?? null,
    taxRateYear: taxProfile?.year ?? null,
  }
}

/**
 * Get historical effective tax rate from previous years
 */
export function getHistoricalTaxRates(): { year: number; rate: number; vestValue: number; taxesWithheld: number }[] {
  const db = getDb()

  const records = db.prepare(`
    SELECT * FROM rsu_vesting_schedule
    WHERE is_vested = 1 AND actual_price_at_vest IS NOT NULL
  `).all() as RsuVesting[]

  // Group by year
  const byYear: Record<number, { vestValue: number; taxesWithheld: number }> = {}

  for (const r of records) {
    const year = new Date(r.vest_date).getFullYear()
    if (!byYear[year]) {
      byYear[year] = { vestValue: 0, taxesWithheld: 0 }
    }
    byYear[year].vestValue += r.shares * (r.actual_price_at_vest || 0)
    byYear[year].taxesWithheld += r.taxes_withheld || 0
  }

  return Object.entries(byYear)
    .map(([year, data]) => ({
      year: parseInt(year),
      rate: data.vestValue > 0 ? data.taxesWithheld / data.vestValue : 0,
      vestValue: data.vestValue,
      taxesWithheld: data.taxesWithheld,
    }))
    .sort((a, b) => b.year - a.year)
}

/**
 * Get reinvestment summary by year
 */
export function getReinvestmentSummary(): { year: number; netProceeds: number; reinvested: number; cashRetained: number; rate: number }[] {
  const db = getDb()

  const records = db.prepare(`
    SELECT * FROM rsu_vesting_schedule
    WHERE is_vested = 1 AND net_proceeds IS NOT NULL
  `).all() as RsuVesting[]

  // Group by year
  const byYear: Record<number, { netProceeds: number; reinvested: number; cashRetained: number }> = {}

  for (const r of records) {
    const year = new Date(r.vest_date).getFullYear()
    if (!byYear[year]) {
      byYear[year] = { netProceeds: 0, reinvested: 0, cashRetained: 0 }
    }
    byYear[year].netProceeds += r.net_proceeds || 0
    byYear[year].reinvested += r.reinvested_amount || 0
    byYear[year].cashRetained += r.cash_retained || 0
  }

  return Object.entries(byYear)
    .map(([year, data]) => ({
      year: parseInt(year),
      ...data,
      rate: data.netProceeds > 0 ? data.reinvested / data.netProceeds : 0,
    }))
    .sort((a, b) => b.year - a.year)
}
