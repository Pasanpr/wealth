/**
 * Parser for E*Trade Stock Plan Benefits CSV export
 *
 * This parses the "ByBenefitType_expanded.csv" export from E*Trade
 * which contains grant info, vest schedules, tax withholdings, and dividends
 */

export interface ETradeGrant {
  grantId: string
  grantDate: string // YYYY-MM-DD
  grantedQty: number
  vestedQty: number
  unvestedQty: number
  grantReason: string // Annual, EIP, Promotion, etc.
  symbol: string
  estimatedMarketValue: number
}

export interface ETradeVestSchedule {
  grantId: string
  vestPeriod: number
  vestDate: string // YYYY-MM-DD
  vestedQty: number // Shares that vested (0 for future vests)
  releasedQty: number
  totalTaxesPaid: number
  sellableQty: number
  estCostBasisPerShare: number
  status: 'vested' | 'pending' // 'Paid at Vest' vs 'Due at Vest'
}

export interface ETradeVestWithGrant extends ETradeVestSchedule {
  grant: ETradeGrant
}

export interface ParsedETradeData {
  grants: ETradeGrant[]
  vestSchedules: ETradeVestWithGrant[]
  // Derived data for RSU tracking
  upcomingVests: UpcomingVest[]
  completedVests: CompletedVest[]
}

export interface UpcomingVest {
  grantId: string
  grantDate: string
  vestDate: string
  shares: number
  grantReason: string
  symbol: string
}

export interface CompletedVest {
  grantId: string
  grantDate: string
  vestDate: string
  shares: number
  vestPrice: number // Cost basis per share = FMV at vest
  totalTaxesPaid: number
  grantReason: string
  symbol: string
}

/**
 * Parse date from E*Trade format (DD-MMM-YYYY or MM/DD/YYYY) to YYYY-MM-DD
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return ''

  // DD-MMM-YYYY format (e.g., 15-JUL-2022)
  const dmy = dateStr.match(/(\d{1,2})-([A-Z]{3})-(\d{4})/i)
  if (dmy) {
    const months: Record<string, string> = {
      JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
      JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
    }
    const [, day, mon, year] = dmy
    const month = months[mon.toUpperCase()] || '01'
    return `${year}-${month}-${day.padStart(2, '0')}`
  }

  // MM/DD/YYYY format
  const mdy = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (mdy) {
    const [, month, day, year] = mdy
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return dateStr
}

/**
 * Parse currency string to number (e.g., "$1,234.56" -> 1234.56)
 */
function parseCurrency(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Parse number string (handles commas)
 */
function parseNumber(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Parse E*Trade Benefits CSV content
 */
export function parseEtradeBenefitsCSV(csvContent: string): ParsedETradeData {
  const lines = csvContent.split('\n')

  // Skip header row (Table 1 and column headers)
  // Find the actual header row
  let headerIndex = 0
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].startsWith('Record Type,')) {
      headerIndex = i
      break
    }
  }

  const headers = parseCSVLine(lines[headerIndex])
  const headerMap = new Map<string, number>()
  headers.forEach((h, i) => headerMap.set(h.trim(), i))

  const grants: ETradeGrant[] = []
  const vestSchedules: ETradeVestWithGrant[] = []

  let currentGrant: ETradeGrant | null = null

  // Process each row
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = parseCSVLine(line)
    const recordType = values[headerMap.get('Record Type') ?? 0]?.trim()

    if (recordType === 'Grant') {
      // Parse grant row
      currentGrant = {
        grantId: values[headerMap.get('Grant Number') ?? 11]?.trim() || '',
        grantDate: parseDate(values[headerMap.get('Grant Date') ?? 2]?.trim() || ''),
        grantedQty: parseNumber(values[headerMap.get('Granted Qty.') ?? 4] || '0'),
        vestedQty: parseNumber(values[headerMap.get('Vested Qty.') ?? 6] || '0'),
        unvestedQty: parseNumber(values[headerMap.get('Unvested Qty.') ?? 7] || '0'),
        grantReason: values[headerMap.get('Grant Reason') ?? headers.length - 1]?.trim() || '',
        symbol: values[headerMap.get('Symbol') ?? 1]?.trim() || 'INTU',
        estimatedMarketValue: parseCurrency(values[headerMap.get('Est. Market Value') ?? 10] || '0'),
      }
      grants.push(currentGrant)
    } else if (recordType === 'Vest Schedule' && currentGrant) {
      // Parse vest schedule row
      const vestPeriod = parseNumber(values[headerMap.get('Vest Period') ?? 18] || '0')
      const vestDateStr = values[headerMap.get('Vest Date') ?? 19]?.trim() || ''
      const vestedQty = parseNumber(values[headerMap.get('Vested Qty.') ?? 24] || '0')
      const releasedQty = parseNumber(values[headerMap.get('Released Qty') ?? 25] || '0')
      const totalTaxesPaid = parseCurrency(values[headerMap.get('Total Taxes Paid') ?? 30] || '0')
      const sellableQty = parseNumber(values[headerMap.get('Sellable Qty.') ?? 31] || '0')

      // Cost basis per share - look for "Est. Cost Basis (per share):"
      let estCostBasisPerShare = 0
      const costBasisIdx = headerMap.get('Est. Cost Basis (per share):')
      if (costBasisIdx !== undefined) {
        estCostBasisPerShare = parseCurrency(values[costBasisIdx] || '0')
      }

      // Determine status from the "Paid at Vest" vs "Due at Vest" indicator
      // This is typically in the column after Sellable Qty
      const statusIndicator = values[33]?.trim() || ''
      const isPending = statusIndicator.includes('Due at Vest') || vestedQty === 0

      if (vestDateStr) {
        vestSchedules.push({
          grantId: currentGrant.grantId,
          vestPeriod,
          vestDate: parseDate(vestDateStr),
          vestedQty,
          releasedQty,
          totalTaxesPaid,
          sellableQty,
          estCostBasisPerShare,
          status: isPending ? 'pending' : 'vested',
          grant: currentGrant,
        })
      }
    }
  }

  // Derive upcoming and completed vests
  const today = new Date().toISOString().split('T')[0]

  const upcomingVests: UpcomingVest[] = []
  const completedVests: CompletedVest[] = []

  // Group vest schedules by grant to calculate shares per period
  const vestsByGrant = new Map<string, ETradeVestWithGrant[]>()
  for (const vest of vestSchedules) {
    if (!vestsByGrant.has(vest.grantId)) {
      vestsByGrant.set(vest.grantId, [])
    }
    vestsByGrant.get(vest.grantId)!.push(vest)
  }

  for (const [grantId, vests] of vestsByGrant) {
    const grant = grants.find(g => g.grantId === grantId)
    if (!grant) continue

    // Calculate shares per vest period based on vested amounts
    // For future vests, estimate based on pattern
    const vestedPeriods = vests.filter(v => v.vestedQty > 0)
    const pendingPeriods = vests.filter(v => v.status === 'pending' && v.vestDate > today)

    // Average shares per vested period (for estimation)
    const avgSharesPerPeriod = vestedPeriods.length > 0
      ? vestedPeriods.reduce((sum, v) => sum + v.vestedQty, 0) / vestedPeriods.length
      : grant.unvestedQty / Math.max(pendingPeriods.length, 1)

    // Process vested periods
    for (const vest of vestedPeriods) {
      completedVests.push({
        grantId: vest.grantId,
        grantDate: grant.grantDate,
        vestDate: vest.vestDate,
        shares: vest.vestedQty,
        vestPrice: vest.estCostBasisPerShare,
        totalTaxesPaid: vest.totalTaxesPaid,
        grantReason: grant.grantReason,
        symbol: grant.symbol,
      })
    }

    // Process pending/future periods
    // Distribute unvested shares across pending periods
    const totalPendingPeriods = pendingPeriods.length
    if (totalPendingPeriods > 0 && grant.unvestedQty > 0) {
      const sharesPerPeriod = Math.floor(grant.unvestedQty / totalPendingPeriods)
      let remainingShares = grant.unvestedQty

      for (let i = 0; i < pendingPeriods.length; i++) {
        const vest = pendingPeriods[i]
        // Last period gets remainder
        const shares = i === pendingPeriods.length - 1
          ? remainingShares
          : Math.min(sharesPerPeriod, remainingShares)

        if (shares > 0) {
          upcomingVests.push({
            grantId: vest.grantId,
            grantDate: grant.grantDate,
            vestDate: vest.vestDate,
            shares,
            grantReason: grant.grantReason,
            symbol: grant.symbol,
          })
          remainingShares -= shares
        }
      }
    }
  }

  // Sort by vest date
  upcomingVests.sort((a, b) => a.vestDate.localeCompare(b.vestDate))
  completedVests.sort((a, b) => a.vestDate.localeCompare(b.vestDate))

  return {
    grants,
    vestSchedules,
    upcomingVests,
    completedVests,
  }
}

/**
 * Parse a CSV line handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)

  return result
}

/**
 * Convert upcoming vests to RSU vesting records for import
 */
export function upcomingVestsToRsuRecords(upcomingVests: UpcomingVest[], currentPrice?: number) {
  return upcomingVests.map(vest => ({
    grant_date: vest.grantDate,
    grant_id: vest.grantId,
    grant_price: currentPrice || 0, // Use current price as estimate
    vest_date: vest.vestDate,
    shares: vest.shares,
    is_vested: false,
    actual_price_at_vest: null,
    sale_date: null,
    sale_price: null,
    gross_proceeds: null,
    taxes_withheld: null,
    net_proceeds: null,
    reinvested_amount: null,
    cash_retained: null,
  }))
}
