import Papa from 'papaparse'

export interface ParseResult<T> {
  data: T[]
  errors: string[]
}

export function parseCSV<T>(
  content: string,
  requiredFields: string[],
  transform?: (row: Record<string, string>) => T | null
): ParseResult<T> {
  const errors: string[] = []
  const data: T[] = []

  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  if (result.errors.length > 0) {
    result.errors.forEach(err => {
      errors.push(`Row ${err.row}: ${err.message}`)
    })
  }

  const headers = result.meta.fields || []
  const missingFields = requiredFields.filter(f => !headers.includes(f))
  if (missingFields.length > 0) {
    errors.push(`Missing required columns: ${missingFields.join(', ')}`)
    return { data: [], errors }
  }

  result.data.forEach((row: unknown, index: number) => {
    const rowData = row as Record<string, string>
    try {
      const transformed = transform ? transform(rowData) : (rowData as unknown as T)
      if (transformed !== null) {
        data.push(transformed)
      }
    } catch (err) {
      errors.push(`Row ${index + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  })

  return { data, errors }
}

// Income Records Parser
export interface IncomeCSVRow {
  date: string
  income_type: string
  amount: number
  description: string | null
  is_recurring: boolean
}

export function parseIncomeCSV(content: string): ParseResult<IncomeCSVRow> {
  return parseCSV<IncomeCSVRow>(
    content,
    ['date', 'income_type', 'amount'],
    (row) => {
      const validTypes = ['salary', 'rsu_vesting', 'bonus', 'other']
      const incomeType = row.income_type?.toLowerCase()
      if (!validTypes.includes(incomeType)) {
        throw new Error(`Invalid income_type: ${row.income_type}`)
      }
      return {
        date: row.date,
        income_type: incomeType,
        amount: parseFloat(row.amount),
        description: row.description || null,
        is_recurring: row.is_recurring?.toLowerCase() === 'true',
      }
    }
  )
}

// Credit Card Spending Parser
export interface SpendingCSVRow {
  card_name: string
  year: number
  month: number
  amount: number
}

export function parseSpendingCSV(content: string): ParseResult<SpendingCSVRow> {
  return parseCSV<SpendingCSVRow>(
    content,
    ['card_name', 'year', 'month', 'amount'],
    (row) => ({
      card_name: row.card_name,
      year: parseInt(row.year),
      month: parseInt(row.month),
      amount: parseFloat(row.amount),
    })
  )
}

// Holdings Parser
export interface HoldingsCSVRow {
  date: string
  account_name: string
  symbol: string
  value: number
  shares: number | null
  cost_basis: number | null
}

export function parseHoldingsCSV(content: string): ParseResult<HoldingsCSVRow> {
  return parseCSV<HoldingsCSVRow>(
    content,
    ['date', 'account_name', 'symbol', 'value'],
    (row) => ({
      date: row.date,
      account_name: row.account_name,
      symbol: row.symbol.toUpperCase(),
      value: parseFloat(row.value),
      shares: row.shares ? parseFloat(row.shares) : null,
      cost_basis: row.cost_basis ? parseFloat(row.cost_basis) : null,
    })
  )
}

// Securities Parser
export interface SecuritiesCSVRow {
  symbol: string
  name: string
  asset_class: string | null
}

export function parseSecuritiesCSV(content: string): ParseResult<SecuritiesCSVRow> {
  return parseCSV<SecuritiesCSVRow>(
    content,
    ['symbol', 'name'],
    (row) => ({
      symbol: row.symbol.toUpperCase(),
      name: row.name,
      asset_class: row.asset_class || null,
    })
  )
}

// Cash Flows Parser
export interface CashFlowsCSVRow {
  date: string
  account_name: string
  amount: number
  flow_type: string
  description: string | null
}

export function parseCashFlowsCSV(content: string): ParseResult<CashFlowsCSVRow> {
  return parseCSV<CashFlowsCSVRow>(
    content,
    ['date', 'account_name', 'amount', 'flow_type'],
    (row) => {
      const validTypes = ['contribution', 'withdrawal', 'dividend', 'interest']
      const flowType = row.flow_type?.toLowerCase()
      if (!validTypes.includes(flowType)) {
        throw new Error(`Invalid flow_type: ${row.flow_type}`)
      }
      return {
        date: row.date,
        account_name: row.account_name,
        amount: parseFloat(row.amount),
        flow_type: flowType,
        description: row.description || null,
      }
    }
  )
}

// Tax Profile Parser
export interface TaxProfileCSVRow {
  year: number
  gross_income: number
  federal_tax: number
  state_tax: number
}

export function parseTaxProfileCSV(content: string): ParseResult<TaxProfileCSVRow> {
  return parseCSV<TaxProfileCSVRow>(
    content,
    ['year', 'gross_income', 'federal_tax', 'state_tax'],
    (row) => ({
      year: parseInt(row.year),
      gross_income: parseFloat(row.gross_income),
      federal_tax: parseFloat(row.federal_tax),
      state_tax: parseFloat(row.state_tax),
    })
  )
}
