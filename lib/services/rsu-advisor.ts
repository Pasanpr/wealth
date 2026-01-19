import { getDb } from '@/lib/db'
import { TaxProfile, RsuVesting } from '@/lib/types'

export interface RsuDecision {
  shares: number
  priceAtVest: number
  grossValue: number
  estimatedTax: number
  netProceeds: number
  effectiveRate: number
}

export function calculateRsuNetProceeds(
  shares: number,
  priceAtVest: number,
  taxYear?: number
): RsuDecision | null {
  const db = getDb()

  // Get the most recent tax profile
  const profile = taxYear
    ? db.prepare('SELECT * FROM tax_profile WHERE year = ?').get(taxYear) as TaxProfile | undefined
    : db.prepare('SELECT * FROM tax_profile ORDER BY year DESC LIMIT 1').get() as TaxProfile | undefined

  if (!profile) {
    return null
  }

  const grossValue = shares * priceAtVest
  const estimatedTax = grossValue * profile.effective_rate
  const netProceeds = grossValue - estimatedTax

  return {
    shares,
    priceAtVest,
    grossValue,
    estimatedTax,
    netProceeds,
    effectiveRate: profile.effective_rate,
  }
}

export function getUpcomingVests(): RsuVesting[] {
  const db = getDb()
  const today = new Date().toISOString().split('T')[0]

  return db.prepare(`
    SELECT * FROM rsu_vesting_schedule
    WHERE is_vested = 0 AND vest_date >= ?
    ORDER BY vest_date
    LIMIT 10
  `).all(today) as RsuVesting[]
}

export function getVestingSummary(): {
  pendingShares: number
  vestedShares: number
  pendingValue: number
  vestedValue: number
} {
  const db = getDb()

  const pending = db.prepare(`
    SELECT COALESCE(SUM(shares), 0) as total_shares,
           COALESCE(SUM(shares * grant_price), 0) as total_value
    FROM rsu_vesting_schedule
    WHERE is_vested = 0
  `).get() as { total_shares: number; total_value: number }

  const vested = db.prepare(`
    SELECT COALESCE(SUM(shares), 0) as total_shares,
           COALESCE(SUM(shares * COALESCE(actual_price_at_vest, grant_price)), 0) as total_value
    FROM rsu_vesting_schedule
    WHERE is_vested = 1
  `).get() as { total_shares: number; total_value: number }

  return {
    pendingShares: pending.total_shares,
    vestedShares: vested.total_shares,
    pendingValue: pending.total_value,
    vestedValue: vested.total_value,
  }
}
