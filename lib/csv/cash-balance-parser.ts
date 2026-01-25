/**
 * Parser for cash balance CSV data.
 * Auto-detects checking/savings rows from spreadsheet sections like "Sheet 1: 2024".
 */

export interface ParsedCashMonth {
  year: number
  month: number
  accountBalances: { accountName: string; balance: number }[]
}

export interface ParsedCashData {
  months: ParsedCashMonth[]
  accountNames: string[]
  errors: string[]
}

// Parse currency string like "$1,234.56" or "($1,234.56)" to number
function parseCurrency(value: string): number {
  if (!value || value.trim() === '' || value === '-') return 0

  let cleaned = value.replace(/[$\s\t]/g, '').trim()

  // Handle negative in parentheses
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')')
  if (isNegative) {
    cleaned = cleaned.slice(1, -1)
  }

  // Handle negative with minus sign
  const hasMinusSign = cleaned.startsWith('-')
  if (hasMinusSign) {
    cleaned = cleaned.slice(1)
  }

  cleaned = cleaned.replace(/,/g, '')

  const num = parseFloat(cleaned) || 0
  return (isNegative || hasMinusSign) ? -num : num
}

// Extract month number from header like "January 2020"
function parseMonthHeader(header: string): { month: number; year: number } | null {
  const months: Record<string, number> = {
    'january': 1, 'february': 2, 'march': 3, 'april': 4,
    'may': 5, 'june': 6, 'july': 7, 'august': 8,
    'september': 9, 'october': 10, 'november': 11, 'december': 12
  }

  const match = header.toLowerCase().match(/^(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})$/)
  if (match) {
    return { month: months[match[1]], year: parseInt(match[2]) }
  }
  return null
}

// Patterns that indicate a row is a cash account
const CASH_ACCOUNT_INDICATORS = [
  'checking',
  'savings',
]

// Rows to exclude from cash account detection
const NON_CASH_PATTERNS = [
  'desired',      // "Checking Desired End"
  'available',    // "Available Checking"
  'payment',      // "Checking Payment"
  'transfer',     // Skip transfer rows
]

// Detect if a row name looks like a cash account
function isCashAccountRow(rowName: string): boolean {
  const lower = rowName.toLowerCase()

  // First check if it's explicitly excluded
  if (NON_CASH_PATTERNS.some(pattern => lower.includes(pattern))) {
    return false
  }

  // Then check if it matches any cash account indicator
  return CASH_ACCOUNT_INDICATORS.some(indicator => lower.includes(indicator))
}

// Extract a clean account name from the row name
function extractAccountName(rowName: string): string {
  let name = rowName.trim()

  // Capitalize first letter of each word
  return name.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Determine account type from name
function getAccountType(name: string): 'checking' | 'savings' | 'money_market' | 'other' {
  const lower = name.toLowerCase()
  if (lower.includes('checking')) return 'checking'
  if (lower.includes('savings')) return 'savings'
  if (lower.includes('money market')) return 'money_market'
  return 'other'
}

export function parseCashBalanceCSV(csvContent: string): ParsedCashData {
  const errors: string[] = []
  const months: ParsedCashMonth[] = []
  const accountNamesSet = new Set<string>()

  const lines = csvContent.split('\n').map(line => line.trim())

  let monthHeaders: { month: number; year: number }[] = []
  let inSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    const cells = parseCSVLine(line)

    // Check for section header like "Sheet 1: 2020"
    const sectionMatch = cells[0]?.match(/^(?:Credit Card Payments|Sheet\s*\d*):\s*(\d{4})$/i)
    if (sectionMatch) {
      inSection = true
      continue
    }

    // Check for month headers row
    if (inSection && cells.length > 1) {
      const potentialMonths = cells.slice(1).map(parseMonthHeader).filter(Boolean)
      if (potentialMonths.length >= 6) {
        monthHeaders = potentialMonths as { month: number; year: number }[]

        // Initialize month data
        for (const mh of monthHeaders) {
          const existing = months.find(m => m.year === mh.year && m.month === mh.month)
          if (!existing) {
            months.push({
              year: mh.year,
              month: mh.month,
              accountBalances: [],
            })
          }
        }
        continue
      }
    }

    // Skip if not in a section or no month headers yet
    if (!inSection || monthHeaders.length === 0) continue

    const rowName = cells[0]?.toLowerCase().trim()
    if (!rowName) continue

    // Only extract cash account rows
    if (isCashAccountRow(rowName)) {
      const accountName = extractAccountName(cells[0])
      accountNamesSet.add(accountName)

      for (let j = 0; j < monthHeaders.length && j + 1 < cells.length; j++) {
        const mh = monthHeaders[j]
        const value = parseCurrency(cells[j + 1])

        const monthData = months.find(m => m.year === mh.year && m.month === mh.month)
        if (monthData) {
          const existingAccount = monthData.accountBalances.find(a => a.accountName === accountName)
          if (existingAccount) {
            existingAccount.balance = value
          } else {
            monthData.accountBalances.push({ accountName, balance: value })
          }
        }
      }
    }
  }

  // Sort months chronologically
  months.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })

  return {
    months,
    accountNames: Array.from(accountNamesSet),
    errors
  }
}

// Parse a CSV line handling quoted values
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

export { getAccountType }
