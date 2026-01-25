import { getDb } from '@/lib/db'
import {
  PayStatement,
  PayStatementItem,
  PayStatementItemWithCategory,
  PayStatementDeposit,
  PayStatementWithItems,
  ParsedPayStatement,
  PayItemCategory,
  AnnualPaySummary,
  YtdPaySummary,
  PayItemCategoryCode,
} from '@/lib/types'

/**
 * Get all pay statements, optionally filtered by year
 */
export function getPayStatements(year?: number): PayStatement[] {
  const db = getDb()

  if (year) {
    return db
      .prepare(
        `SELECT * FROM pay_statements
         WHERE strftime('%Y', pay_date) = ?
         ORDER BY pay_date DESC`
      )
      .all(String(year)) as PayStatement[]
  }

  return db
    .prepare('SELECT * FROM pay_statements ORDER BY pay_date DESC')
    .all() as PayStatement[]
}

/**
 * Get a single pay statement by ID with all items and deposits
 */
export function getPayStatementById(id: number): PayStatementWithItems | null {
  const db = getDb()

  const statement = db
    .prepare('SELECT * FROM pay_statements WHERE id = ?')
    .get(id) as PayStatement | undefined

  if (!statement) return null

  const items = db
    .prepare(
      `SELECT i.*, c.code as category_code, c.name as category_name
       FROM pay_statement_items i
       JOIN pay_item_categories c ON i.category_id = c.id
       WHERE i.pay_statement_id = ?
       ORDER BY c.display_order, i.item_name`
    )
    .all(id) as PayStatementItemWithCategory[]

  const deposits = db
    .prepare('SELECT * FROM pay_statement_deposits WHERE pay_statement_id = ?')
    .all(id) as PayStatementDeposit[]

  return { ...statement, items, deposits }
}

/**
 * Check if a pay statement already exists (by file hash or date range + amount)
 */
export function checkDuplicate(
  fileHash?: string,
  periodStart?: string,
  periodEnd?: string,
  payDate?: string,
  grossEarnings?: number
): PayStatement | null {
  const db = getDb()

  // First check by file hash if provided
  if (fileHash) {
    const byHash = db
      .prepare('SELECT * FROM pay_statements WHERE source_file_hash = ?')
      .get(fileHash) as PayStatement | undefined
    if (byHash) return byHash
  }

  // Check by period + pay date + gross earnings (to allow multiple paychecks on same date)
  // This handles cases like regular paycheck + RSU vesting on same day
  if (periodStart && periodEnd && payDate && grossEarnings !== undefined) {
    const byPeriodAndAmount = db
      .prepare(
        `SELECT * FROM pay_statements
         WHERE period_start = ? AND period_end = ? AND pay_date = ?
         AND ABS(gross_earnings - ?) < 0.01`
      )
      .get(periodStart, periodEnd, payDate, grossEarnings) as PayStatement | undefined
    if (byPeriodAndAmount) return byPeriodAndAmount
  }

  return null
}

/**
 * Create a new pay statement from parsed data
 */
export function createPayStatement(data: ParsedPayStatement, fileHash?: string): PayStatement {
  const db = getDb()

  // Get category IDs
  const categories = db
    .prepare('SELECT id, code FROM pay_item_categories')
    .all() as { id: number; code: string }[]
  const categoryMap = new Map(categories.map(c => [c.code, c.id]))

  const insertStatement = db.prepare(`
    INSERT INTO pay_statements (
      period_start, period_end, pay_date, source_type, source_file_hash,
      gross_earnings, total_taxes, total_deductions, employer_benefits, net_pay,
      ytd_gross_earnings, ytd_total_taxes, ytd_total_deductions, ytd_net_pay
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const result = insertStatement.run(
    data.periodStart,
    data.periodEnd,
    data.payDate,
    data.sourceType,
    fileHash ?? null,
    data.grossEarnings,
    data.totalTaxes,
    data.totalDeductions,
    data.employerBenefits,
    data.netPay,
    data.ytdGrossEarnings ?? null,
    data.ytdTotalTaxes ?? null,
    data.ytdTotalDeductions ?? null,
    data.ytdNetPay ?? null
  )

  const statementId = result.lastInsertRowid as number

  // Insert line items
  const insertItem = db.prepare(`
    INSERT INTO pay_statement_items (
      pay_statement_id, category_id, item_code, item_name,
      current_amount, ytd_amount, hours, rate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const item of data.items) {
    const categoryId = categoryMap.get(item.categoryCode)
    if (!categoryId) continue

    insertItem.run(
      statementId,
      categoryId,
      item.itemCode,
      item.itemName,
      item.currentAmount,
      item.ytdAmount ?? null,
      item.hours ?? null,
      item.rate ?? null
    )
  }

  // Insert deposits
  const insertDeposit = db.prepare(`
    INSERT INTO pay_statement_deposits (
      pay_statement_id, account_type, account_last4, amount
    ) VALUES (?, ?, ?, ?)
  `)

  for (const deposit of data.deposits) {
    insertDeposit.run(
      statementId,
      deposit.accountType,
      deposit.accountLast4 ?? null,
      deposit.amount
    )
  }

  return getPayStatementById(statementId) as PayStatement
}

/**
 * Update an existing pay statement
 */
export function updatePayStatement(
  id: number,
  data: Partial<ParsedPayStatement>
): PayStatement | null {
  const db = getDb()
  const existing = getPayStatementById(id)
  if (!existing) return null

  const updateFields: string[] = []
  const updateValues: (string | number | null)[] = []

  if (data.periodStart !== undefined) {
    updateFields.push('period_start = ?')
    updateValues.push(data.periodStart)
  }
  if (data.periodEnd !== undefined) {
    updateFields.push('period_end = ?')
    updateValues.push(data.periodEnd)
  }
  if (data.payDate !== undefined) {
    updateFields.push('pay_date = ?')
    updateValues.push(data.payDate)
  }
  if (data.grossEarnings !== undefined) {
    updateFields.push('gross_earnings = ?')
    updateValues.push(data.grossEarnings)
  }
  if (data.totalTaxes !== undefined) {
    updateFields.push('total_taxes = ?')
    updateValues.push(data.totalTaxes)
  }
  if (data.totalDeductions !== undefined) {
    updateFields.push('total_deductions = ?')
    updateValues.push(data.totalDeductions)
  }
  if (data.employerBenefits !== undefined) {
    updateFields.push('employer_benefits = ?')
    updateValues.push(data.employerBenefits)
  }
  if (data.netPay !== undefined) {
    updateFields.push('net_pay = ?')
    updateValues.push(data.netPay)
  }

  if (updateFields.length > 0) {
    updateFields.push("updated_at = datetime('now')")
    updateValues.push(id)
    db.prepare(
      `UPDATE pay_statements SET ${updateFields.join(', ')} WHERE id = ?`
    ).run(...updateValues)
  }

  return getPayStatementById(id)
}

/**
 * Delete a pay statement and all related items
 */
export function deletePayStatement(id: number): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM pay_statements WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * Get annual summary of pay statements
 */
export function getAnnualSummary(year: number): AnnualPaySummary {
  const db = getDb()

  // Get totals for the year
  const totals = db
    .prepare(
      `SELECT
        SUM(gross_earnings) as total_gross,
        SUM(total_taxes) as total_taxes,
        SUM(total_deductions) as total_deductions,
        SUM(employer_benefits) as total_benefits,
        SUM(net_pay) as total_net,
        COUNT(*) as count
       FROM pay_statements
       WHERE strftime('%Y', pay_date) = ?`
    )
    .get(String(year)) as {
      total_gross: number | null
      total_taxes: number | null
      total_deductions: number | null
      total_benefits: number | null
      total_net: number | null
      count: number
    }

  // Get breakdown by item code
  const itemBreakdown = db
    .prepare(
      `SELECT
        c.code as category_code,
        i.item_code,
        SUM(i.current_amount) as total
       FROM pay_statement_items i
       JOIN pay_item_categories c ON i.category_id = c.id
       JOIN pay_statements s ON i.pay_statement_id = s.id
       WHERE strftime('%Y', s.pay_date) = ?
       GROUP BY c.code, i.item_code`
    )
    .all(String(year)) as {
      category_code: PayItemCategoryCode
      item_code: string
      total: number
    }[]

  const byCategory: AnnualPaySummary['byCategory'] = {
    earnings: {},
    taxes: {},
    pretaxDeductions: {},
    posttaxDeductions: {},
    employerBenefits: {},
    adjustments: {},
  }

  for (const row of itemBreakdown) {
    switch (row.category_code) {
      case 'earnings':
        byCategory.earnings[row.item_code] = row.total
        break
      case 'statutory_tax':
        byCategory.taxes[row.item_code] = row.total
        break
      case 'pretax_deduction':
        byCategory.pretaxDeductions[row.item_code] = row.total
        break
      case 'posttax_deduction':
        byCategory.posttaxDeductions[row.item_code] = row.total
        break
      case 'employer_benefit':
        byCategory.employerBenefits[row.item_code] = row.total
        break
      case 'adjustment':
        byCategory.adjustments[row.item_code] = row.total
        break
    }
  }

  return {
    year,
    totalGrossEarnings: totals.total_gross ?? 0,
    totalTaxes: totals.total_taxes ?? 0,
    totalDeductions: totals.total_deductions ?? 0,
    totalEmployerBenefits: totals.total_benefits ?? 0,
    totalNetPay: totals.total_net ?? 0,
    statementCount: totals.count,
    byCategory,
  }
}

/**
 * Get YTD summary up to a specific date
 */
export function getYtdSummary(year: number, asOfDate?: string): YtdPaySummary {
  const db = getDb()
  const endDate = asOfDate ?? new Date().toISOString().split('T')[0]

  const totals = db
    .prepare(
      `SELECT
        SUM(gross_earnings) as total_gross,
        SUM(total_taxes) as total_taxes,
        SUM(total_deductions) as total_deductions,
        SUM(employer_benefits) as total_benefits,
        SUM(net_pay) as total_net,
        COUNT(*) as count
       FROM pay_statements
       WHERE strftime('%Y', pay_date) = ? AND pay_date <= ?`
    )
    .get(String(year), endDate) as {
      total_gross: number | null
      total_taxes: number | null
      total_deductions: number | null
      total_benefits: number | null
      total_net: number | null
      count: number
    }

  return {
    year,
    asOfDate: endDate,
    grossEarnings: totals.total_gross ?? 0,
    totalTaxes: totals.total_taxes ?? 0,
    totalDeductions: totals.total_deductions ?? 0,
    employerBenefits: totals.total_benefits ?? 0,
    netPay: totals.total_net ?? 0,
    statementCount: totals.count,
  }
}

/**
 * Get all pay item categories
 */
export function getPayItemCategories(): PayItemCategory[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM pay_item_categories ORDER BY display_order')
    .all() as PayItemCategory[]
}

/**
 * Get available years with pay statements
 */
export function getPayStatementYears(): number[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT DISTINCT strftime('%Y', pay_date) as year
       FROM pay_statements
       ORDER BY year DESC`
    )
    .all() as { year: string }[]
  return rows.map(r => parseInt(r.year, 10))
}

/**
 * Get annual salary (regular earnings only) for a given year
 */
export function getAnnualSalary(year: number): number {
  const db = getDb()
  const result = db
    .prepare(
      `SELECT SUM(i.current_amount) as total
       FROM pay_statement_items i
       JOIN pay_statements s ON i.pay_statement_id = s.id
       WHERE strftime('%Y', s.pay_date) = ?
         AND i.item_code = 'REGULAR'`
    )
    .get(String(year)) as { total: number | null }
  return result.total ?? 0
}

/**
 * Income type mapping from pay statement item codes
 */
type IncomeType = 'salary' | 'rsu_vesting' | 'bonus' | 'other'

interface SyncResult {
  created: number
  updated: number
  skipped: number
  details: Array<{
    incomeType: IncomeType
    amount: number
    action: 'created' | 'updated' | 'skipped'
    reason?: string
  }>
}

/**
 * Sync a pay statement to income records
 * Creates/updates income records based on pay statement line items:
 * - REGULAR -> salary
 * - RSU_VEST -> rsu_vesting
 * - BONUS -> bonus
 * - DIV_EQV (dividend equivalents) -> other
 */
export function syncPayStatementToIncome(statementId: number): SyncResult {
  const db = getDb()
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, details: [] }

  // Get the pay statement with items
  const statement = getPayStatementById(statementId)
  if (!statement) {
    throw new Error(`Pay statement ${statementId} not found`)
  }

  // Define mapping from item codes to income types
  const itemCodeToIncomeType: Record<string, IncomeType> = {
    REGULAR: 'salary',
    RSU_VEST: 'rsu_vesting',
    BONUS: 'bonus',
    DIV_EQV: 'other',
  }

  // Get earnings items that should create income records
  const earningsItems = statement.items.filter(
    item => item.category_code === 'earnings' && item.current_amount > 0
  )

  for (const item of earningsItems) {
    const incomeType = itemCodeToIncomeType[item.item_code]
    if (!incomeType) {
      // Skip earnings types we don't track (like GYM_SUBSIDY)
      result.skipped++
      result.details.push({
        incomeType: 'other',
        amount: item.current_amount,
        action: 'skipped',
        reason: `Untracked earning type: ${item.item_code}`,
      })
      continue
    }

    // Check if an income record already exists for this statement + type
    const existing = db
      .prepare(
        `SELECT id FROM income_records
         WHERE pay_statement_id = ? AND income_type = ?`
      )
      .get(statementId, incomeType) as { id: number } | undefined

    const description = `${item.item_name} - Pay Date ${statement.pay_date}`
    const isRecurring = incomeType === 'salary' ? 1 : 0

    if (existing) {
      // Update existing record
      db.prepare(
        `UPDATE income_records
         SET amount = ?, date = ?, description = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(item.current_amount, statement.pay_date, description, existing.id)

      result.updated++
      result.details.push({
        incomeType,
        amount: item.current_amount,
        action: 'updated',
      })
    } else {
      // Create new record
      db.prepare(
        `INSERT INTO income_records
         (income_type, amount, date, description, is_recurring, pay_statement_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(incomeType, item.current_amount, statement.pay_date, description, isRecurring, statementId)

      result.created++
      result.details.push({
        incomeType,
        amount: item.current_amount,
        action: 'created',
      })
    }
  }

  return result
}

/**
 * Sync all pay statements from a given year to income records
 */
export function syncYearToIncome(year: number): SyncResult {
  const statements = getPayStatements(year)
  const combinedResult: SyncResult = { created: 0, updated: 0, skipped: 0, details: [] }

  for (const statement of statements) {
    const result = syncPayStatementToIncome(statement.id)
    combinedResult.created += result.created
    combinedResult.updated += result.updated
    combinedResult.skipped += result.skipped
    combinedResult.details.push(...result.details)
  }

  return combinedResult
}

/**
 * Check if a pay statement has been synced to income records
 */
export function isPayStatementSynced(statementId: number): boolean {
  const db = getDb()
  const result = db
    .prepare('SELECT COUNT(*) as count FROM income_records WHERE pay_statement_id = ?')
    .get(statementId) as { count: number }
  return result.count > 0
}

/**
 * Get sync status for multiple pay statements
 */
export function getPayStatementSyncStatus(statementIds: number[]): Map<number, boolean> {
  const db = getDb()
  const statusMap = new Map<number, boolean>()

  if (statementIds.length === 0) return statusMap

  const placeholders = statementIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT DISTINCT pay_statement_id
       FROM income_records
       WHERE pay_statement_id IN (${placeholders})`
    )
    .all(...statementIds) as { pay_statement_id: number }[]

  const syncedIds = new Set(rows.map(r => r.pay_statement_id))

  for (const id of statementIds) {
    statusMap.set(id, syncedIds.has(id))
  }

  return statusMap
}
