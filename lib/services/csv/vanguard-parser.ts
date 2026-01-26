/**
 * Parser for Vanguard OFX/CSV export files
 *
 * This parses the standard Vanguard CSV export (OfxDownload.csv) which contains:
 * - Holdings section: Current positions with shares, prices, and values
 * - Transactions section: Trade history including buys, sells, dividends, etc.
 */

export interface VanguardHolding {
  accountNumber: string
  accountType: string
  investmentName: string
  symbol: string
  shares: number
  sharePrice: number
  totalValue: number
}

export interface VanguardTransaction {
  accountNumber: string
  accountType: string
  tradeDate: string // YYYY-MM-DD
  settlementDate: string // YYYY-MM-DD
  transactionType: string // Buy, Sell, Dividend, Reinvestment, etc.
  transactionDescription: string
  investmentName: string
  symbol: string
  shares: number
  sharePrice: number
  principalAmount: number
  commissionsAndFees: number
  netAmount: number
  accruedInterest: number
}

export interface ParsedVanguardData {
  holdings: VanguardHolding[]
  transactions: VanguardTransaction[]
  accounts: {
    accountNumber: string
    accountType: string
    totalValue: number
  }[]
  summary: {
    totalHoldingsValue: number
    totalAccounts: number
    totalSecurities: number
    transactionCount: number
    dateRange: {
      earliest: string
      latest: string
    } | null
  }
}

/**
 * Parse date from Vanguard format (MM/DD/YYYY) to YYYY-MM-DD
 */
function parseDate(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return ''

  // MM/DD/YYYY format
  const match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (match) {
    const [, month, day, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  return dateStr
}

/**
 * Parse currency/number string to number (handles $, commas, parentheses for negatives)
 */
function parseNumber(value: string): number {
  if (!value || value.trim() === '') return 0

  // Handle parentheses for negatives (e.g., "(100.00)" -> -100.00)
  const isNegative = value.includes('(') && value.includes(')')

  // Remove $, commas, parentheses, spaces
  const cleaned = value.replace(/[$,\s()]/g, '')
  const num = parseFloat(cleaned)

  if (isNaN(num)) return 0
  return isNegative ? -num : num
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
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())

  return result
}

/**
 * Detect if a line is a holdings header
 */
function isHoldingsHeader(values: string[]): boolean {
  const normalized = values.map(v => v.toLowerCase().trim())
  return normalized.includes('account number') &&
    normalized.includes('investment name') &&
    normalized.includes('symbol') &&
    normalized.includes('shares')
}

/**
 * Detect if a line is a transactions header
 */
function isTransactionsHeader(values: string[]): boolean {
  const normalized = values.map(v => v.toLowerCase().trim())
  return normalized.includes('account number') &&
    normalized.includes('trade date') &&
    normalized.includes('transaction type')
}

/**
 * Parse Vanguard CSV content
 */
export function parseVanguardCSV(csvContent: string): ParsedVanguardData {
  const lines = csvContent.split('\n').filter(line => line.trim() !== '')

  const holdings: VanguardHolding[] = []
  const transactions: VanguardTransaction[] = []

  let mode: 'unknown' | 'holdings' | 'transactions' = 'unknown'
  let headerMap = new Map<string, number>()

  for (const line of lines) {
    const values = parseCSVLine(line)

    // Check for section headers
    if (isHoldingsHeader(values)) {
      mode = 'holdings'
      headerMap = new Map()
      values.forEach((h, i) => headerMap.set(h.toLowerCase().trim(), i))
      continue
    }

    if (isTransactionsHeader(values)) {
      mode = 'transactions'
      headerMap = new Map()
      values.forEach((h, i) => headerMap.set(h.toLowerCase().trim(), i))
      continue
    }

    // Skip empty or summary rows
    if (values.length < 3 || !values[0]) continue

    if (mode === 'holdings') {
      const accountNumber = values[headerMap.get('account number') ?? 0] || ''
      const symbol = values[headerMap.get('symbol') ?? 2] || ''

      // Skip rows without valid data (like totals or empty rows)
      if (!accountNumber || !symbol) continue

      holdings.push({
        accountNumber,
        accountType: '', // Will be populated from transactions
        investmentName: values[headerMap.get('investment name') ?? 1] || '',
        symbol,
        shares: parseNumber(values[headerMap.get('shares') ?? 3] || ''),
        sharePrice: parseNumber(values[headerMap.get('share price') ?? 4] || ''),
        totalValue: parseNumber(values[headerMap.get('total value') ?? 5] || ''),
      })
    }

    if (mode === 'transactions') {
      const accountNumber = values[headerMap.get('account number') ?? 0] || ''
      const tradeDate = values[headerMap.get('trade date') ?? 1] || ''
      const transactionType = values[headerMap.get('transaction type') ?? 3] || ''

      // Skip rows without valid data
      if (!accountNumber || !tradeDate) continue

      const accountType = values[headerMap.get('account type') ?? 14] || ''

      transactions.push({
        accountNumber,
        accountType,
        tradeDate: parseDate(tradeDate),
        settlementDate: parseDate(values[headerMap.get('settlement date') ?? 2] || ''),
        transactionType,
        transactionDescription: values[headerMap.get('transaction description') ?? 4] || '',
        investmentName: values[headerMap.get('investment name') ?? 5] || '',
        symbol: values[headerMap.get('symbol') ?? 6] || '',
        shares: parseNumber(values[headerMap.get('shares') ?? 7] || ''),
        sharePrice: parseNumber(values[headerMap.get('share price') ?? 8] || ''),
        principalAmount: parseNumber(values[headerMap.get('principal amount') ?? 9] || ''),
        commissionsAndFees: parseNumber(values[headerMap.get('commissions and fees') ?? 10] || ''),
        netAmount: parseNumber(values[headerMap.get('net amount') ?? 11] || ''),
        accruedInterest: parseNumber(values[headerMap.get('accrued interest') ?? 12] || ''),
      })

      // Update account type in holdings for this account
      if (accountType) {
        for (const holding of holdings) {
          if (holding.accountNumber === accountNumber && !holding.accountType) {
            holding.accountType = accountType
          }
        }
      }
    }
  }

  // Calculate summary
  const accountMap = new Map<string, { accountType: string; totalValue: number }>()

  for (const holding of holdings) {
    const existing = accountMap.get(holding.accountNumber)
    if (existing) {
      existing.totalValue += holding.totalValue
    } else {
      accountMap.set(holding.accountNumber, {
        accountType: holding.accountType,
        totalValue: holding.totalValue,
      })
    }
  }

  const accounts = Array.from(accountMap.entries()).map(([accountNumber, data]) => ({
    accountNumber,
    accountType: data.accountType,
    totalValue: data.totalValue,
  }))

  // Get unique securities
  const uniqueSecurities = new Set(holdings.map(h => h.symbol))

  // Get date range from transactions
  let dateRange: { earliest: string; latest: string } | null = null
  if (transactions.length > 0) {
    const dates = transactions.map(t => t.tradeDate).filter(d => d).sort()
    if (dates.length > 0) {
      dateRange = {
        earliest: dates[0],
        latest: dates[dates.length - 1],
      }
    }
  }

  return {
    holdings,
    transactions,
    accounts,
    summary: {
      totalHoldingsValue: holdings.reduce((sum, h) => sum + h.totalValue, 0),
      totalAccounts: accounts.length,
      totalSecurities: uniqueSecurities.size,
      transactionCount: transactions.length,
      dateRange,
    },
  }
}

/**
 * Categorize transaction types into flow types
 */
export function categorizeTransactionType(transactionType: string): 'contribution' | 'withdrawal' | 'dividend' | 'interest' | 'buy' | 'sell' | 'transfer' | 'other' {
  const type = transactionType.toLowerCase().trim()

  if (type.includes('dividend')) return 'dividend'
  if (type.includes('interest')) return 'interest'
  if (type.includes('buy') || type.includes('reinvestment')) return 'buy'
  if (type.includes('sell')) return 'sell'
  if (type.includes('contribution') || type.includes('funds received')) return 'contribution'
  if (type.includes('withdrawal')) return 'withdrawal'
  if (type.includes('transfer') || type.includes('sweep')) return 'transfer'

  return 'other'
}

/**
 * Map Vanguard account type to database account type code
 */
export function mapAccountType(vanguardType: string): string {
  const type = vanguardType.toLowerCase().trim()

  if (type.includes('roth ira')) return 'roth_ira'
  if (type.includes('traditional ira') || type.includes('rollover')) return 'ira'
  if (type.includes('roth 401') || type.includes('roth401')) return 'roth_401k'
  if (type.includes('401') || type.includes('401k')) return '401k'
  if (type.includes('529')) return '529'
  if (type.includes('hsa')) return 'hsa'

  // Default to brokerage for individual/taxable accounts
  return 'brokerage'
}

/**
 * Convert holdings to database-compatible records
 */
export function holdingsToDbRecords(
  holdings: VanguardHolding[],
  accountMap: Map<string, number>,
  securityMap: Map<string, number>,
  date: string
): Array<{
  account_id: number
  security_id: number
  date: string
  value: number
  shares: number
  cost_basis: number | null
}> {
  const records: Array<{
    account_id: number
    security_id: number
    date: string
    value: number
    shares: number
    cost_basis: number | null
  }> = []

  for (const holding of holdings) {
    const accountId = accountMap.get(holding.accountNumber)
    const securityId = securityMap.get(holding.symbol.toUpperCase())

    if (accountId && securityId) {
      records.push({
        account_id: accountId,
        security_id: securityId,
        date,
        value: holding.totalValue,
        shares: holding.shares,
        cost_basis: null, // Vanguard CSV doesn't include cost basis in holdings
      })
    }
  }

  return records
}

/**
 * Convert transactions to cash flow records
 */
export function transactionsToCashFlows(
  transactions: VanguardTransaction[],
  accountMap: Map<string, number>
): Array<{
  account_id: number
  date: string
  amount: number
  flow_type: 'contribution' | 'withdrawal' | 'dividend' | 'interest'
  description: string
}> {
  const records: Array<{
    account_id: number
    date: string
    amount: number
    flow_type: 'contribution' | 'withdrawal' | 'dividend' | 'interest'
    description: string
  }> = []

  for (const tx of transactions) {
    const accountId = accountMap.get(tx.accountNumber)
    if (!accountId) continue

    const category = categorizeTransactionType(tx.transactionType)

    // Only include contribution, withdrawal, dividend, and interest as cash flows
    if (!['contribution', 'withdrawal', 'dividend', 'interest'].includes(category)) continue

    records.push({
      account_id: accountId,
      date: tx.tradeDate,
      amount: Math.abs(tx.netAmount),
      flow_type: category as 'contribution' | 'withdrawal' | 'dividend' | 'interest',
      description: `${tx.transactionType}: ${tx.investmentName || tx.transactionDescription}`.trim(),
    })
  }

  return records
}
