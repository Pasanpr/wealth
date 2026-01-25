/**
 * Unified parser for monthly balance CSV data.
 * Extracts both credit card balances and cash account balances from spreadsheet sections.
 */

export interface ParsedMonth {
  year: number
  month: number
  cardBalances: { cardName: string; balance: number }[]
  accountBalances: { accountName: string; balance: number }[]
}

export interface ParsedSpreadsheetData {
  months: ParsedMonth[]
  cardNames: string[]
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

// Credit card indicators
const CARD_INDICATORS = [
  'balance',    // "Sapphire Balance", "Freedom Balance"
  'card',       // "Apple Card"
  'visa',       // "Gap Visa"
  'mastercard',
  'amex',
  'discover',
  'chase',
  'citi',
  'capital one',
]

// Cash account indicators
const CASH_ACCOUNT_INDICATORS = [
  'checking',
  'savings',
]

// Rows to exclude from both detections
const EXCLUDED_PATTERNS = [
  'mortgage',
  'transfer',
  'payment',
  'available',
  'credit',     // "2020 Credit" is a total row
  'desired',
  'wealthfront',
  'car payment',
]

type RowType = 'card' | 'cash' | 'none'

// Classify a row
function classifyRow(rowName: string): RowType {
  const lower = rowName.toLowerCase()

  // Check exclusions first
  if (EXCLUDED_PATTERNS.some(pattern => lower.includes(pattern))) {
    return 'none'
  }

  // Check for cash accounts first (more specific)
  if (CASH_ACCOUNT_INDICATORS.some(indicator => lower.includes(indicator))) {
    return 'cash'
  }

  // Then check for credit cards
  if (CARD_INDICATORS.some(indicator => lower.includes(indicator))) {
    return 'card'
  }

  return 'none'
}

// Extract a clean card name
function extractCardName(rowName: string): string {
  let cardName = rowName.trim()
  cardName = cardName.replace(/\s*balance\s*/i, '').trim()
  return cardName.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Extract a clean account name
function extractAccountName(rowName: string): string {
  return rowName.trim().split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

// Determine account type from name
export function getAccountType(name: string): 'checking' | 'savings' | 'money_market' | 'other' {
  const lower = name.toLowerCase()
  if (lower.includes('checking')) return 'checking'
  if (lower.includes('savings')) return 'savings'
  if (lower.includes('money market')) return 'money_market'
  return 'other'
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

export function parseSpreadsheetCSV(csvContent: string): ParsedSpreadsheetData {
  const errors: string[] = []
  const months: ParsedMonth[] = []
  const cardNamesSet = new Set<string>()
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
              cardBalances: [],
              accountBalances: [],
            })
          }
        }
        continue
      }
    }

    // Skip if not in a section or no month headers yet
    if (!inSection || monthHeaders.length === 0) continue

    const rowName = cells[0]?.trim()
    if (!rowName) continue

    const rowType = classifyRow(rowName)

    if (rowType === 'card') {
      const cardName = extractCardName(rowName)
      cardNamesSet.add(cardName)

      for (let j = 0; j < monthHeaders.length && j + 1 < cells.length; j++) {
        const mh = monthHeaders[j]
        const value = parseCurrency(cells[j + 1])

        const monthData = months.find(m => m.year === mh.year && m.month === mh.month)
        if (monthData) {
          const existing = monthData.cardBalances.find(c => c.cardName === cardName)
          if (existing) {
            existing.balance = value
          } else {
            monthData.cardBalances.push({ cardName, balance: value })
          }
        }
      }
    } else if (rowType === 'cash') {
      const accountName = extractAccountName(rowName)
      accountNamesSet.add(accountName)

      for (let j = 0; j < monthHeaders.length && j + 1 < cells.length; j++) {
        const mh = monthHeaders[j]
        const value = parseCurrency(cells[j + 1])

        const monthData = months.find(m => m.year === mh.year && m.month === mh.month)
        if (monthData) {
          const existing = monthData.accountBalances.find(a => a.accountName === accountName)
          if (existing) {
            existing.balance = value
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
    cardNames: Array.from(cardNamesSet),
    accountNames: Array.from(accountNamesSet),
    errors
  }
}
