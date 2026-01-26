import { PDFParse } from 'pdf-parse'

/**
 * Parser for Vanguard 529 College Savings Plan PDF statements
 */

export interface Vanguard529Account {
  accountNumber: string
  beneficiaryName: string
  portfolioName: string
  units: number
  unitValue: number
  totalValue: number
  principal: number
  earnings: number
  ytdContributions: number
  assetMix: {
    stocks: number
    fixedIncome: number
    shortTerm: number
  }
}

export interface Vanguard529Contribution {
  accountNumber: string
  tradeDate: string // YYYY-MM-DD
  portfolioName: string
  transactionType: string
  amount: number
  unitsTransacted: number
  unitValue: number
}

export interface Parsed529Statement {
  statementDate: string // YYYY-MM-DD
  totalValue: number
  accounts: Vanguard529Account[]
  contributions: Vanguard529Contribution[]
}

export interface Parse529Result {
  success: boolean
  data?: Parsed529Statement
  error?: string
  rawText?: string
}

/**
 * Parse a Vanguard 529 statement PDF
 */
export async function parseVanguard529Pdf(
  pdfBuffer: Buffer,
  debug: boolean = false
): Promise<Parse529Result> {
  try {
    const parser = new PDFParse({ data: pdfBuffer })
    const textResult = await parser.getText()
    const text = textResult.text
    await parser.destroy()

    if (debug) {
      console.log('=== RAW PDF TEXT ===')
      console.log(text)
      console.log('=== END RAW PDF TEXT ===')
    }

    // Parse statement date
    const statementDate = parseStatementDate(text)
    if (!statementDate) {
      return { success: false, error: 'Could not extract statement date' }
    }

    // Parse total value
    const totalValue = parseTotalValue(text)

    // Parse accounts
    const accounts = parseAccounts(text, debug)
    if (accounts.length === 0) {
      return { success: false, error: 'Could not extract any 529 accounts' }
    }

    // Parse contributions
    const contributions = parseContributions(text, accounts, debug)

    const result: Parsed529Statement = {
      statementDate,
      totalValue,
      accounts,
      contributions,
    }

    return {
      success: true,
      data: result,
      rawText: debug ? text : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error parsing PDF'
    return { success: false, error: message }
  }
}

/**
 * Parse statement date from header (e.g., "December 31, 2025, year-to-date statement")
 */
function parseStatementDate(text: string): string | null {
  const match = text.match(/(\w+)\s+(\d{1,2}),\s+(\d{4}),?\s*year-to-date/i)
  if (match) {
    const monthNames: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    }
    const month = monthNames[match[1].toLowerCase()]
    const day = match[2].padStart(2, '0')
    const year = match[3]
    return `${year}-${month}-${day}`
  }
  return null
}

/**
 * Parse total value from statement overview
 */
function parseTotalValue(text: string): number {
  // Look for "Total value of all accounts as of" followed by amount
  const match = text.match(/\$([0-9,]+\.\d{2})\s*Total\s*value\s*of\s*all\s*accounts/i)
  if (match) {
    return parseAmount(match[1])
  }

  // Alternative: look for total in accounts section
  const totalMatch = text.match(/Total\s*\$([0-9,]+\.\d{2})\s*\$([0-9,]+\.\d{2})/i)
  if (totalMatch) {
    return parseAmount(totalMatch[2]) // Second value is current year
  }

  return 0
}

/**
 * Parse individual 529 accounts from the PDF
 */
function parseAccounts(text: string, debug: boolean = false): Vanguard529Account[] {
  const accounts: Vanguard529Account[] = []

  // Find each "529 Plan Account" section with beneficiary
  // Pattern: "529 Plan Account\nOwner: ...\nBeneficiary: ..."
  const accountSections = text.split(/529\s*Plan\s*Account/i).slice(1)

  for (const section of accountSections) {
    // Extract beneficiary name
    const beneficiaryMatch = section.match(/Beneficiary[:\s]+([A-Za-z]+\s+[A-Za-z]+\s+[A-Za-z]+)/i)
    if (!beneficiaryMatch) continue

    const beneficiaryName = beneficiaryMatch[1].trim()

    // Extract account number (XXXXX3388-01 format)
    const accountNumMatch = section.match(/Account\s*number[:\s]*(XXXXX?\d+-\d+)/i)
    const accountNumber = accountNumMatch ? accountNumMatch[1] : ''

    // Extract portfolio name (e.g., "TRGT 32/33")
    const portfolioMatch = section.match(/(TRGT\s*\d+\/\d+)/i)
    const portfolioName = portfolioMatch ? portfolioMatch[1].replace(/\s+/g, ' ') : ''

    // Extract investment summary values
    const principalMatch = section.match(/Principal\s*\$([0-9,]+\.\d{2})/i)
    const earningsMatch = section.match(/Earnings\s*\$?([0-9,]+\.\d{2})/i)
    const totalValueMatch = section.match(/Total\s*value\s*\$([0-9,]+\.\d{2})/i)
    const contributionsMatch = section.match(/\d{4}\s*contributions\s*\$([0-9,]+\.\d{2})/i)

    // Extract units and unit value from portfolio table
    // Format: "TRGT 32/33 3,837.3614 $13.930000 $53,454.44 5,899.4169 $15.960000 $94,154.69"
    const portfolioDataMatch = section.match(
      new RegExp(portfolioName.replace('/', '\\/') + '\\s+([0-9,.]+)\\s+\\$([0-9.]+)\\s+\\$[0-9,.]+\\s+([0-9,.]+)\\s+\\$([0-9.]+)\\s+\\$([0-9,.]+)', 'i')
    )

    let units = 0
    let unitValue = 0
    let totalValue = 0

    if (portfolioDataMatch) {
      // Current year values (positions 3, 4, 5)
      units = parseFloat(portfolioDataMatch[3].replace(/,/g, ''))
      unitValue = parseFloat(portfolioDataMatch[4])
      totalValue = parseAmount(portfolioDataMatch[5])
    } else if (totalValueMatch) {
      totalValue = parseAmount(totalValueMatch[1])
    }

    // Extract asset mix
    const stocksMatch = section.match(/Stocks\s*([0-9.]+)%/i)
    const fixedIncomeMatch = section.match(/Fixed\s*Income\s*([0-9.]+)%/i)
    const shortTermMatch = section.match(/Short-term\s*(?:investments|reserves)?\s*([0-9.]+)%/i)

    const account: Vanguard529Account = {
      accountNumber,
      beneficiaryName,
      portfolioName,
      units,
      unitValue,
      totalValue,
      principal: principalMatch ? parseAmount(principalMatch[1]) : 0,
      earnings: earningsMatch ? parseAmount(earningsMatch[1]) : 0,
      ytdContributions: contributionsMatch ? parseAmount(contributionsMatch[1]) : 0,
      assetMix: {
        stocks: stocksMatch ? parseFloat(stocksMatch[1]) : 0,
        fixedIncome: fixedIncomeMatch ? parseFloat(fixedIncomeMatch[1]) : 0,
        shortTerm: shortTermMatch ? parseFloat(shortTermMatch[1]) : 0,
      },
    }

    if (debug) {
      console.log('=== PARSED ACCOUNT ===')
      console.log(JSON.stringify(account, null, 2))
    }

    accounts.push(account)
  }

  return accounts
}

/**
 * Parse contributions from account activity sections
 */
function parseContributions(
  text: string,
  accounts: Vanguard529Account[],
  debug: boolean = false
): Vanguard529Contribution[] {
  const contributions: Vanguard529Contribution[] = []

  // Find contribution lines: "02/03 TRGT 32/33 Contribution EBT $10,000.00 707.2136 $14.140000"
  const contributionPattern = /(\d{2}\/\d{2})\s+(TRGT\s*\d+\/\d+)\s+Contribution\s+\w+\s+\$?([0-9,]+\.\d{2})\s+([0-9,.]+)\s+\$?([0-9.]+)/gi

  let match
  while ((match = contributionPattern.exec(text)) !== null) {
    const dateStr = match[1] // MM/DD
    const portfolioName = match[2].replace(/\s+/g, ' ')
    const amount = parseAmount(match[3])
    const unitsTransacted = parseFloat(match[4].replace(/,/g, ''))
    const unitValue = parseFloat(match[5])

    // Find which account this contribution belongs to
    const account = accounts.find(a =>
      a.portfolioName.toLowerCase() === portfolioName.toLowerCase()
    )

    // Convert MM/DD to YYYY-MM-DD (assume current statement year)
    const yearMatch = text.match(/(\d{4}),?\s*year-to-date/i)
    const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString()
    const [month, day] = dateStr.split('/')
    const tradeDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`

    const contribution: Vanguard529Contribution = {
      accountNumber: account?.accountNumber || '',
      tradeDate,
      portfolioName,
      transactionType: 'Contribution',
      amount,
      unitsTransacted,
      unitValue,
    }

    if (debug) {
      console.log('=== PARSED CONTRIBUTION ===')
      console.log(JSON.stringify(contribution, null, 2))
    }

    contributions.push(contribution)
  }

  return contributions
}

/**
 * Parse monetary amount (e.g., "94,154.69" -> 94154.69)
 */
function parseAmount(str: string): number {
  if (!str) return 0
  const cleaned = str.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

/**
 * Convert parsed 529 account to portfolio holdings format
 */
export function convert529ToHoldings(
  account: Vanguard529Account,
  statementDate: string,
  accountId: number,
  securityId: number
): {
  account_id: number
  security_id: number
  date: string
  value: number
  shares: number
  cost_basis: number
} {
  return {
    account_id: accountId,
    security_id: securityId,
    date: statementDate,
    value: account.totalValue,
    shares: account.units,
    cost_basis: account.principal,
  }
}

/**
 * Convert parsed 529 contribution to cash flow format
 */
export function convert529ToCashFlow(
  contribution: Vanguard529Contribution,
  accountId: number
): {
  account_id: number
  date: string
  amount: number
  flow_type: 'contribution'
  description: string
} {
  return {
    account_id: accountId,
    date: contribution.tradeDate,
    amount: contribution.amount,
    flow_type: 'contribution',
    description: `529 Contribution: ${contribution.portfolioName}`,
  }
}
