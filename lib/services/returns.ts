import Decimal from 'decimal.js'
import { getDb } from '@/lib/db'
import { ReturnMetrics, PortfolioSnapshot, CashFlow } from '@/lib/types'
import { differenceInDays, parseISO } from 'date-fns'

// Configure Decimal.js for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

interface SnapshotWithFlows {
  date: string
  value: number
  cashFlows: number
}

export function calculateSimpleReturn(
  startValue: number,
  endValue: number,
  netCashFlows: number
): number {
  if (startValue === 0) return 0
  return (endValue - startValue - netCashFlows) / startValue
}

export function calculateTimeWeightedReturn(snapshots: SnapshotWithFlows[]): number {
  if (snapshots.length < 2) return 0

  let twr = new Decimal(1)

  for (let i = 1; i < snapshots.length; i++) {
    const prevValue = new Decimal(snapshots[i - 1].value)
    const currValue = new Decimal(snapshots[i].value)
    const cashFlow = new Decimal(snapshots[i].cashFlows)

    // Adjust for cash flows: assume they occur at start of period
    const adjustedPrevValue = prevValue.plus(cashFlow)

    if (adjustedPrevValue.isZero()) continue

    const periodReturn = currValue.div(adjustedPrevValue)
    twr = twr.mul(periodReturn)
  }

  return twr.minus(1).toNumber()
}

export function calculateMoneyWeightedReturn(
  startValue: number,
  endValue: number,
  cashFlows: { date: string; amount: number }[],
  startDate: string,
  endDate: string
): number {
  // Money-weighted return (IRR) using Newton-Raphson method
  const totalDays = differenceInDays(parseISO(endDate), parseISO(startDate))
  if (totalDays === 0) return 0

  // Build cash flow array: negative for outflows (contributions), positive for inflows (withdrawals)
  // Initial value as negative (investment), final value as positive (return)
  const flows: { amount: number; days: number }[] = [
    { amount: -startValue, days: 0 },
  ]

  cashFlows.forEach(cf => {
    const days = differenceInDays(parseISO(cf.date), parseISO(startDate))
    // Contributions are positive in our DB, but negative for IRR calculation
    flows.push({ amount: -cf.amount, days })
  })

  flows.push({ amount: endValue, days: totalDays })

  // Newton-Raphson to find daily rate
  let rate = 0.0001 // Initial guess (0.01% daily)
  const maxIterations = 100
  const tolerance = 1e-10

  for (let iter = 0; iter < maxIterations; iter++) {
    let npv = 0
    let derivative = 0

    for (const flow of flows) {
      const factor = Math.pow(1 + rate, -flow.days / 365)
      npv += flow.amount * factor
      derivative -= (flow.days / 365) * flow.amount * Math.pow(1 + rate, -flow.days / 365 - 1)
    }

    if (Math.abs(npv) < tolerance) break
    if (Math.abs(derivative) < tolerance) break

    rate = rate - npv / derivative
  }

  return rate
}

export function annualizeReturn(returnValue: number, days: number): number {
  if (days <= 0) return 0
  if (days >= 365) {
    return Math.pow(1 + returnValue, 365 / days) - 1
  }
  // For periods less than a year, don't annualize (would be misleading)
  return returnValue
}

export function getPortfolioReturns(
  accountId?: number,
  startDate?: string,
  endDate?: string
): ReturnMetrics | null {
  const db = getDb()

  // Determine date range
  let dateCondition = ''
  const params: (number | string)[] = []

  if (accountId) {
    dateCondition = 'WHERE account_id = ?'
    params.push(accountId)
  }

  // Get snapshots
  const snapshotQuery = `
    SELECT date, SUM(value) as value
    FROM (
      SELECT h.date, h.value
      FROM holdings h
      ${accountId ? 'WHERE h.account_id = ?' : ''}
    )
    GROUP BY date
    ORDER BY date
  `
  const snapshots = db.prepare(snapshotQuery).all(...(accountId ? [accountId] : [])) as { date: string; value: number }[]

  if (snapshots.length < 2) return null

  const actualStartDate = startDate || snapshots[0].date
  const actualEndDate = endDate || snapshots[snapshots.length - 1].date

  // Filter snapshots by date range
  const filteredSnapshots = snapshots.filter(s => s.date >= actualStartDate && s.date <= actualEndDate)

  if (filteredSnapshots.length < 2) return null

  const startSnapshot = filteredSnapshots[0]
  const endSnapshot = filteredSnapshots[filteredSnapshots.length - 1]

  // Get cash flows in range
  const cashFlowQuery = `
    SELECT date, amount, flow_type
    FROM cash_flows
    WHERE date > ? AND date <= ?
    ${accountId ? 'AND account_id = ?' : ''}
    ORDER BY date
  `
  const cashFlowParams = [actualStartDate, actualEndDate]
  if (accountId) cashFlowParams.push(accountId.toString())

  const cashFlows = db.prepare(cashFlowQuery).all(...cashFlowParams) as CashFlow[]

  // Calculate net cash flows (contributions - withdrawals)
  const netCashFlows = cashFlows.reduce((sum, cf) => {
    const multiplier = cf.flow_type === 'contribution' ? 1 : -1
    return sum + cf.amount * multiplier
  }, 0)

  // Simple return
  const simpleReturn = calculateSimpleReturn(startSnapshot.value, endSnapshot.value, netCashFlows)

  // Build snapshots with cash flows for TWR
  const snapshotsWithFlows: SnapshotWithFlows[] = filteredSnapshots.map(s => {
    const flowsOnDate = cashFlows.filter(cf => cf.date === s.date)
    const flowAmount = flowsOnDate.reduce((sum, cf) => {
      const multiplier = cf.flow_type === 'contribution' ? 1 : -1
      return sum + cf.amount * multiplier
    }, 0)
    return {
      date: s.date,
      value: s.value,
      cashFlows: flowAmount,
    }
  })

  const timeWeightedReturn = calculateTimeWeightedReturn(snapshotsWithFlows)

  // MWR
  const cashFlowsForMWR = cashFlows.map(cf => ({
    date: cf.date,
    amount: cf.flow_type === 'contribution' ? cf.amount : -cf.amount,
  }))

  const moneyWeightedReturn = calculateMoneyWeightedReturn(
    startSnapshot.value,
    endSnapshot.value,
    cashFlowsForMWR,
    actualStartDate,
    actualEndDate
  )

  const days = differenceInDays(parseISO(actualEndDate), parseISO(actualStartDate))
  const annualizedReturn = annualizeReturn(timeWeightedReturn, days)

  return {
    simpleReturn,
    timeWeightedReturn,
    moneyWeightedReturn,
    annualizedReturn,
    startDate: actualStartDate,
    endDate: actualEndDate,
    startValue: startSnapshot.value,
    endValue: endSnapshot.value,
    netCashFlows,
  }
}
