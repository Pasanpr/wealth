/**
 * Parser for cash flow CSV data in the format from the user's spreadsheet.
 * Handles sections like "Credit Card Payments: 2020" with monthly columns.
 */

export interface ParsedCashFlowMonth {
  year: number
  month: number
  cardBalances: { cardName: string; balance: number }[]
  checking: number
  transfers: number
  checkingDesiredEnd: number
  checkingPayment: number
  savingsPayment: number
}

export interface ParsedCashFlowData {
  months: ParsedCashFlowMonth[]
  cardNames: string[]
  errors: string[]
}

// Parse currency string like "$1,234.56" or "($1,234.56)" to number
function parseCurrency(value: string): number {
  if (!value || value.trim() === '' || value === '-') return 0

  // Remove currency symbols, spaces, tabs
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

  // Remove commas
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

// Known credit card row names (case insensitive matching)
const CARD_ROW_PATTERNS = [
  'sapphire balance',
  'freedom balance',
  'apple card',
  'gap visa'
]

// Row name mappings for other data (order matters - more specific patterns first)
const ROW_MAPPINGS: { pattern: string; field: string; exact?: boolean }[] = [
  { pattern: 'checking desired end', field: 'checkingDesiredEnd' },
  { pattern: 'checking payment', field: 'checkingPayment' },
  { pattern: 'savings payment', field: 'savingsPayment' },
  { pattern: 'ally checking', field: 'checking' },
  { pattern: 'transfers', field: 'transfers' },
  // 'checking' must come last and be more specific to avoid matching 'available checking'
]

// Check if row is a checking balance row (not available checking, not checking payment, etc.)
function isCheckingBalanceRow(rowName: string): boolean {
  const lower = rowName.toLowerCase()
  // Must be exactly "checking" or "ally checking", not "available checking" or "checking payment" etc.
  return (lower === 'checking' || lower === 'ally checking')
}

export function parseCashFlowCSV(csvContent: string): ParsedCashFlowData {
  const errors: string[] = []
  const months: ParsedCashFlowMonth[] = []
  const cardNamesSet = new Set<string>()

  // Split into lines
  const lines = csvContent.split('\n').map(line => line.trim())

  let currentYearSection: number | null = null
  let monthHeaders: { month: number; year: number }[] = []
  let inCreditCardSection = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue

    // Parse CSV line (handle commas inside quotes)
    const cells = parseCSVLine(line)

    // Check for section header like "Credit Card Payments: 2020"
    const sectionMatch = cells[0]?.match(/^Credit Card Payments:\s*(\d{4})$/i)
    if (sectionMatch) {
      currentYearSection = parseInt(sectionMatch[1])
      inCreditCardSection = true
      continue
    }

    // Check for month headers row (first cell empty or label, rest are "Month YYYY")
    if (inCreditCardSection && cells.length > 1) {
      const potentialMonths = cells.slice(1).map(parseMonthHeader).filter(Boolean)
      if (potentialMonths.length >= 6) {
        // This is likely the header row
        monthHeaders = potentialMonths as { month: number; year: number }[]

        // Initialize month data if not exists
        for (const mh of monthHeaders) {
          const existing = months.find(m => m.year === mh.year && m.month === mh.month)
          if (!existing) {
            months.push({
              year: mh.year,
              month: mh.month,
              cardBalances: [],
              checking: 0,
              transfers: 0,
              checkingDesiredEnd: 0,
              checkingPayment: 0,
              savingsPayment: 0,
            })
          }
        }
        continue
      }
    }

    // Skip if not in a credit card section or no month headers yet
    if (!inCreditCardSection || monthHeaders.length === 0) continue

    // Check if this is a data row
    const rowName = cells[0]?.toLowerCase().trim()
    if (!rowName) continue

    // Check if it's a card balance row
    const isCardRow = CARD_ROW_PATTERNS.some(pattern => rowName.includes(pattern.toLowerCase()))
    if (isCardRow) {
      // Extract card name (e.g., "Sapphire Balance" -> "Sapphire")
      let cardName = cells[0].trim()
      // Clean up the card name
      cardName = cardName.replace(/\s*balance\s*/i, '').trim()
      if (cardName.toLowerCase() === 'sapphire') cardName = 'Sapphire'
      if (cardName.toLowerCase() === 'freedom') cardName = 'Freedom'

      cardNamesSet.add(cardName)

      // Parse values for each month
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
      continue
    }

    // Check if it's a checking balance row (exact match to avoid "available checking")
    if (isCheckingBalanceRow(rowName)) {
      for (let j = 0; j < monthHeaders.length && j + 1 < cells.length; j++) {
        const mh = monthHeaders[j]
        const value = parseCurrency(cells[j + 1])

        const monthData = months.find(m => m.year === mh.year && m.month === mh.month)
        if (monthData) {
          monthData.checking = value
        }
      }
      continue
    }

    // Check if it's a known row type
    const mappedRow = ROW_MAPPINGS.find(({ pattern }) =>
      rowName.includes(pattern.toLowerCase())
    )

    if (mappedRow) {
      for (let j = 0; j < monthHeaders.length && j + 1 < cells.length; j++) {
        const mh = monthHeaders[j]
        const value = parseCurrency(cells[j + 1])

        const monthData = months.find(m => m.year === mh.year && m.month === mh.month)
        if (monthData) {
          (monthData as unknown as Record<string, unknown>)[mappedRow.field] = value
        }
      }
    }

    // Check for end of section (empty row or new section)
    if (cells.every(c => !c || c.trim() === '')) {
      // Keep processing, sections are separated by multiple empty rows
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
