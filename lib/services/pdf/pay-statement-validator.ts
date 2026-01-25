import { ParsedPayStatement } from '@/lib/types'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationSeverity
  field: string
  message: string
  expected?: number
  actual?: number
}

export interface ValidationResult {
  isValid: boolean
  issues: ValidationIssue[]
  calculatedNetPay?: number
}

const TOLERANCE = 1.00 // $1.00 tolerance for ADP rounding quirks and multi-item sum differences

/**
 * Detect if this is an RSU vesting stub
 * RSU stubs have: same start/end date, RSU_VEST earning, $0 net pay
 */
function isRsuVestingStub(statement: ParsedPayStatement): boolean {
  const hasRsuVest = statement.items.some(
    i => i.itemCode === 'RSU_VEST' && i.currentAmount > 0
  )
  const singleDayPeriod = statement.periodStart === statement.periodEnd
  const zeroNetPay = statement.netPay === 0

  return hasRsuVest && singleDayPeriod && zeroNetPay
}

/**
 * Validate a parsed pay statement for correctness and completeness
 */
export function validatePayStatement(statement: ParsedPayStatement): ValidationResult {
  const issues: ValidationIssue[] = []
  const isRsu = isRsuVestingStub(statement)

  // 1. Required fields validation
  if (!statement.periodStart) {
    issues.push({
      severity: 'error',
      field: 'periodStart',
      message: 'Pay period start date is required',
    })
  }

  if (!statement.periodEnd) {
    issues.push({
      severity: 'error',
      field: 'periodEnd',
      message: 'Pay period end date is required',
    })
  }

  if (!statement.payDate) {
    issues.push({
      severity: 'error',
      field: 'payDate',
      message: 'Pay date is required',
    })
  }

  // 2. Date validation - periodStart should be before periodEnd
  if (statement.periodStart && statement.periodEnd) {
    const start = new Date(statement.periodStart)
    const end = new Date(statement.periodEnd)
    if (start > end) {
      issues.push({
        severity: 'error',
        field: 'periodStart',
        message: 'Pay period start date must be before end date',
      })
    }
  }

  // 3. At least one earning item required
  const earningsItems = statement.items.filter(i => i.categoryCode === 'earnings')
  if (earningsItems.length === 0 && statement.grossEarnings > 0) {
    issues.push({
      severity: 'warning',
      field: 'items',
      message: 'No earning items found, but gross earnings is greater than 0',
    })
  }

  // 4. Gross earnings validation - should match sum of earnings items
  const calculatedGross = earningsItems.reduce((sum, item) => sum + item.currentAmount, 0)
  if (Math.abs(calculatedGross - statement.grossEarnings) > TOLERANCE) {
    issues.push({
      severity: 'warning',
      field: 'grossEarnings',
      message: 'Gross earnings does not match sum of earning items',
      expected: calculatedGross,
      actual: statement.grossEarnings,
    })
  }

  // 5. Total taxes validation - should match sum of tax items
  const taxItems = statement.items.filter(i => i.categoryCode === 'statutory_tax')
  const calculatedTaxes = taxItems.reduce((sum, item) => sum + item.currentAmount, 0)
  if (Math.abs(calculatedTaxes - statement.totalTaxes) > TOLERANCE) {
    issues.push({
      severity: 'warning',
      field: 'totalTaxes',
      message: 'Total taxes does not match sum of tax items',
      expected: calculatedTaxes,
      actual: statement.totalTaxes,
    })
  }

  // 6. Total deductions validation - should match sum of deduction items
  const deductionItems = statement.items.filter(
    i => i.categoryCode === 'pretax_deduction' || i.categoryCode === 'posttax_deduction'
  )
  const calculatedDeductions = deductionItems.reduce((sum, item) => sum + item.currentAmount, 0)
  if (Math.abs(calculatedDeductions - statement.totalDeductions) > TOLERANCE) {
    issues.push({
      severity: 'warning',
      field: 'totalDeductions',
      message: 'Total deductions does not match sum of deduction items',
      expected: calculatedDeductions,
      actual: statement.totalDeductions,
    })
  }

  // 7. Employer benefits validation - should match sum of benefit items
  const benefitItems = statement.items.filter(i => i.categoryCode === 'employer_benefit')
  const calculatedBenefits = benefitItems.reduce((sum, item) => sum + item.currentAmount, 0)
  if (Math.abs(calculatedBenefits - statement.employerBenefits) > TOLERANCE) {
    issues.push({
      severity: 'warning',
      field: 'employerBenefits',
      message: 'Employer benefits does not match sum of benefit items',
      expected: calculatedBenefits,
      actual: statement.employerBenefits,
    })
  }

  // 8. Net pay math check: grossEarnings - totalTaxes - totalDeductions + adjustments ≈ netPay
  // Use extracted totals (not item sums) since the PDF totals are what matter
  // For RSU vesting stubs, net pay is $0 (you receive shares, not cash)
  const adjustmentItems = statement.items.filter(i => i.categoryCode === 'adjustment')
  const totalAdjustments = adjustmentItems.reduce((sum, item) => sum + item.currentAmount, 0)

  // Calculate both with and without adjustments - use whichever is closer to actual net pay
  // This handles cases where "adjustments" are informational or already included in gross
  const calcWithAdjustments = statement.grossEarnings - statement.totalTaxes - statement.totalDeductions + totalAdjustments
  const calcWithoutAdjustments = statement.grossEarnings - statement.totalTaxes - statement.totalDeductions

  const diffWithAdj = Math.abs(calcWithAdjustments - statement.netPay)
  const diffWithoutAdj = Math.abs(calcWithoutAdjustments - statement.netPay)

  // Use the calculation that's closer to actual net pay
  const calculatedNetPay = diffWithAdj <= diffWithoutAdj ? calcWithAdjustments : calcWithoutAdjustments

  if (isRsu) {
    // RSU stubs: net pay should be $0, calculated net represents share value retained
    if (statement.netPay !== 0) {
      issues.push({
        severity: 'warning',
        field: 'netPay',
        message: 'RSU vesting stub should have $0 net pay (you receive shares, not cash)',
        expected: 0,
        actual: statement.netPay,
      })
    }
  } else if (Math.abs(calculatedNetPay - statement.netPay) > TOLERANCE) {
    const usedAdjustments = diffWithAdj <= diffWithoutAdj && totalAdjustments !== 0
    issues.push({
      severity: 'warning',
      field: 'netPay',
      message: `Net pay does not match calculation (gross - taxes - deductions${usedAdjustments ? ' + adjustments' : ''})`,
      expected: calculatedNetPay,
      actual: statement.netPay,
    })
  }

  // 9. Reasonable ranges validation
  if (statement.grossEarnings < 0) {
    issues.push({
      severity: 'error',
      field: 'grossEarnings',
      message: 'Gross earnings cannot be negative',
    })
  }

  if (statement.totalTaxes < 0) {
    issues.push({
      severity: 'error',
      field: 'totalTaxes',
      message: 'Total taxes cannot be negative',
    })
  }

  if (statement.totalDeductions < 0) {
    issues.push({
      severity: 'error',
      field: 'totalDeductions',
      message: 'Total deductions cannot be negative',
    })
  }

  // 10. Individual item validation
  for (const item of statement.items) {
    if (item.currentAmount < 0) {
      issues.push({
        severity: 'warning',
        field: `items.${item.itemCode}`,
        message: `Item "${item.itemName}" has negative current amount`,
        actual: item.currentAmount,
      })
    }

    // YTD should be >= current (unless it's first paycheck of year or YTD wasn't extracted)
    // Only warn if YTD is explicitly set to a non-zero value that's less than current
    // A YTD of 0 or undefined usually means it wasn't extracted, not that it's actually 0
    if (
      item.ytdAmount !== undefined &&
      item.ytdAmount > 0 &&
      item.ytdAmount < item.currentAmount - TOLERANCE
    ) {
      issues.push({
        severity: 'warning',
        field: `items.${item.itemCode}.ytdAmount`,
        message: `Item "${item.itemName}" YTD is less than current amount`,
        expected: item.currentAmount,
        actual: item.ytdAmount,
      })
    }
  }

  // 11. Deposit validation - deposits should sum to net pay (approximately)
  // Skip for RSU stubs - they show $0 net pay but may have deposits from other sources
  if (statement.deposits.length > 0 && !isRsu) {
    const totalDeposits = statement.deposits.reduce((sum, d) => sum + d.amount, 0)
    if (Math.abs(totalDeposits - statement.netPay) > TOLERANCE) {
      issues.push({
        severity: 'warning',
        field: 'deposits',
        message: 'Total deposits does not match net pay',
        expected: statement.netPay,
        actual: totalDeposits,
      })
    }
  }

  // Determine if result is valid (no errors, warnings are okay)
  const hasErrors = issues.some(i => i.severity === 'error')

  return {
    isValid: !hasErrors,
    issues,
    calculatedNetPay,
  }
}

/**
 * Format validation issues for display
 */
export function formatValidationIssues(issues: ValidationIssue[]): string {
  return issues
    .map(issue => {
      let msg = `[${issue.severity.toUpperCase()}] ${issue.message}`
      if (issue.expected !== undefined && issue.actual !== undefined) {
        msg += ` (expected: $${issue.expected.toFixed(2)}, got: $${issue.actual.toFixed(2)})`
      }
      return msg
    })
    .join('\n')
}
