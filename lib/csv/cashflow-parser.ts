/**
 * Parser for credit card balance CSV data.
 * Auto-detects credit card rows from spreadsheet sections like "Sheet 1: 2024".
 */

export interface ParsedCashFlowMonth {
  year: number
  month: number
  cardBalances: { cardName: string; balance: number }[]
}

export interface ParsedCashFlowData {
  months: ParsedCashFlowMonth[]
  cardNames: string[]
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

// Patterns that indicate a row is likely a credit card (case insensitive)
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

// Rows to explicitly exclude from credit card detection
const NON_CARD_PATTERNS = [
  'checking',
  'savings',
  'mortgage',
  'transfer',
  'payment',
  'available',
  'credit',     // "2020 Credit" is a total row, not a card
  'desired',
  'wealthfront',
  'car payment',
]

// Detect if a row name looks like a credit card
function isCreditCardRow(rowName: string): boolean {
  const lower = rowName.toLowerCase()

  // First check if it's explicitly excluded
  if (NON_CARD_PATTERNS.some(pattern => lower.includes(pattern))) {
    return false
  }

  // Then check if it matches any card indicator
  return CARD_INDICATORS.some(indicator => lower.includes(indicator))
}

// Extract a clean card name from the row name
function extractCardName(rowName: string): string {
  let cardName = rowName.trim()

  // Remove common suffixes
  cardName = cardName.replace(/\s*balance\s*/i, '').trim()

  // Capitalize first letter of each word
  return cardName.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}

export function parseCashFlowCSV(csvContent: string): ParsedCashFlowData {
  const errors: string[] = []
  const months: ParsedCashFlowMonth[] = []
  const cardNamesSet = new Set<string>()

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

    // Only extract credit card rows
    if (isCreditCardRow(rowName)) {
      const cardName = extractCardName(cells[0])
      cardNamesSet.add(cardName)

      for (let j = 0; j < monthHeaders.length && j + 1 < cells.length; j++) {
        const mh = monthHeaders[j]
        const value = parseCurrency(cells[j + 1])

        const monthData = months.find(m => m.year === mh.year && m.month === mh.month)
        if (monthData) {
          const existingCard = monthData.cardBalances.find(c => c.cardName === cardName)
          if (existingCard) {
            existingCard.balance = value
          } else {
            monthData.cardBalances.push({ cardName, balance: value })
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
