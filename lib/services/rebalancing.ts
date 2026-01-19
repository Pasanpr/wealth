import { getDb } from '@/lib/db'
import { AllocationItem, AssetClass, HoldingWithDetails } from '@/lib/types'

interface AllocationResult {
  allocations: AllocationItem[]
  totalValue: number
  threshold: number
  needsRebalancing: boolean
}

export function calculateAllocation(): AllocationResult {
  const db = getDb()

  // Get target allocations
  const assetClasses = db.prepare(`
    SELECT * FROM asset_classes
    ORDER BY display_order, name
  `).all() as AssetClass[]

  // Get latest holdings grouped by asset class
  const holdings = db.prepare(`
    SELECT h.*, s.asset_class_id, ac.name as asset_class_name
    FROM holdings h
    JOIN securities s ON h.security_id = s.id
    LEFT JOIN asset_classes ac ON s.asset_class_id = ac.id
    INNER JOIN (
      SELECT account_id, security_id, MAX(date) as max_date
      FROM holdings
      GROUP BY account_id, security_id
    ) latest ON h.account_id = latest.account_id
             AND h.security_id = latest.security_id
             AND h.date = latest.max_date
  `).all() as (HoldingWithDetails & { asset_class_id: number | null })[]

  // Calculate total portfolio value
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)

  if (totalValue === 0) {
    return {
      allocations: assetClasses.map(ac => ({
        assetClass: ac.name,
        currentValue: 0,
        currentAllocation: 0,
        targetAllocation: ac.target_allocation / 100,
        difference: -ac.target_allocation / 100,
        action: 'buy' as const,
        actionAmount: 0,
      })),
      totalValue: 0,
      threshold: 5,
      needsRebalancing: false,
    }
  }

  // Get rebalance threshold from settings
  const thresholdSetting = db.prepare(`SELECT value FROM settings WHERE key = 'rebalance_threshold'`).get() as { value: string } | undefined
  const threshold = thresholdSetting ? parseFloat(thresholdSetting.value) : 5

  // Group holdings by asset class
  const valueByAssetClass = new Map<string, number>()

  for (const holding of holdings) {
    const className = holding.asset_class_name || 'Unclassified'
    const current = valueByAssetClass.get(className) || 0
    valueByAssetClass.set(className, current + holding.value)
  }

  // Add unclassified if there are unclassified holdings
  const unclassifiedValue = valueByAssetClass.get('Unclassified') || 0

  // Build allocation items
  const allocations: AllocationItem[] = assetClasses.map(ac => {
    const currentValue = valueByAssetClass.get(ac.name) || 0
    const currentAllocation = currentValue / totalValue
    const targetAllocation = ac.target_allocation / 100
    const difference = currentAllocation - targetAllocation

    let action: 'buy' | 'sell' | 'hold' = 'hold'
    let actionAmount = 0

    if (Math.abs(difference) > threshold / 100) {
      if (difference > 0) {
        action = 'sell'
        actionAmount = difference * totalValue
      } else {
        action = 'buy'
        actionAmount = Math.abs(difference) * totalValue
      }
    }

    return {
      assetClass: ac.name,
      currentValue,
      currentAllocation,
      targetAllocation,
      difference,
      action,
      actionAmount,
    }
  })

  // Add unclassified if exists
  if (unclassifiedValue > 0) {
    allocations.push({
      assetClass: 'Unclassified',
      currentValue: unclassifiedValue,
      currentAllocation: unclassifiedValue / totalValue,
      targetAllocation: 0,
      difference: unclassifiedValue / totalValue,
      action: 'sell',
      actionAmount: unclassifiedValue,
    })
  }

  const needsRebalancing = allocations.some(a => a.action !== 'hold')

  return {
    allocations,
    totalValue,
    threshold,
    needsRebalancing,
  }
}

export function getAccountBreakdown(): { accountId: number; accountName: string; value: number; percentage: number }[] {
  const db = getDb()

  const holdings = db.prepare(`
    SELECT h.account_id, a.name as account_name, h.value
    FROM holdings h
    JOIN accounts a ON h.account_id = a.id
    INNER JOIN (
      SELECT account_id, security_id, MAX(date) as max_date
      FROM holdings
      GROUP BY account_id, security_id
    ) latest ON h.account_id = latest.account_id
             AND h.security_id = latest.security_id
             AND h.date = latest.max_date
  `).all() as { account_id: number; account_name: string; value: number }[]

  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)

  // Group by account
  const accountMap = new Map<number, { name: string; value: number }>()
  for (const h of holdings) {
    const current = accountMap.get(h.account_id) || { name: h.account_name, value: 0 }
    accountMap.set(h.account_id, { name: h.account_name, value: current.value + h.value })
  }

  return Array.from(accountMap.entries()).map(([accountId, data]) => ({
    accountId,
    accountName: data.name,
    value: data.value,
    percentage: totalValue > 0 ? data.value / totalValue : 0,
  })).sort((a, b) => b.value - a.value)
}
