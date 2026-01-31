// Asset Classes
export interface AssetClass {
  id: number
  name: string
  description: string | null
  target_allocation: number
  display_order: number
  created_at: string
  updated_at: string
}

// Account Types
export interface AccountType {
  id: number
  code: string
  name: string
  is_tax_advantaged: boolean
  created_at: string
}

// Securities
export interface Security {
  id: number
  asset_class_id: number | null
  symbol: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface SecurityWithAssetClass extends Security {
  asset_class_name: string | null
}

// Accounts
export interface Account {
  id: number
  name: string
  account_type_id: number
  institution: string | null
  beneficiary: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface AccountWithType extends Account {
  account_type_code: string
  account_type_name: string
  is_tax_advantaged: boolean
}

// Credit Cards
export interface CreditCard {
  id: number
  name: string
  issuer: string | null
  last4: string | null
  credit_limit: number | null
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

// Tax Profile
export interface TaxProfile {
  id: number
  year: number
  gross_income: number
  federal_tax: number
  state_tax: number
  effective_rate: number
  created_at: string
  updated_at: string
}

// Income Records
export type IncomeType = 'salary' | 'rsu_vesting' | 'bonus' | 'other'

export interface IncomeRecord {
  id: number
  income_type: IncomeType
  amount: number
  date: string
  description: string | null
  is_recurring: boolean
  created_at: string
  updated_at: string
}

// RSU Vesting Schedule with sale tracking
export interface RsuVesting {
  id: number
  // Grant info
  grant_date: string
  grant_id: string | null
  grant_price: number
  // Vesting info
  vest_date: string
  shares: number
  is_vested: boolean
  actual_price_at_vest: number | null // FMV at vesting (vest_price)
  // Sale tracking (populated when shares are sold)
  sale_date: string | null
  sale_price: number | null
  gross_proceeds: number | null
  taxes_withheld: number | null
  net_proceeds: number | null
  reinvested_amount: number | null
  cash_retained: number | null
  // Timestamps
  created_at: string
  updated_at: string
}

// RSU summary metrics for dashboard
export interface RsuMetrics {
  ytdVestValue: number // Total value of vested RSUs this year (shares × vest_price)
  ytdTaxesWithheld: number // Total taxes withheld this year
  effectiveTaxRate: number // ytdTaxesWithheld / ytdVestValue
  totalReinvested: number // Total reinvested this year
  reinvestmentRate: number // reinvested / net proceeds
  projectedIncome: number // Future vests × current price (all pending)
  pendingShares: number // Unvested shares
  vestedShares: number // Total vested shares
  // Annual projection fields
  annualProjectedGross: number // YTD actual + remaining current year @ current price
  annualProjectedNet: number | null // gross × (1 - tax rate), null if no tax profile
  remainingYearGross: number // Projected value of unvested shares for current year
  remainingYearShares: number // Shares still to vest this year
  taxRateUsed: number | null // Effective rate used for net calculation
  taxRateYear: number | null // Year of tax profile used
}

// RSU W-2 data for tax reconciliation (legacy - use W2Form instead)
export interface RsuW2Data {
  id: number
  year: number
  total_rsu_income: number
  federal_withheld: number
  state_withheld: number
  social_security_withheld: number
  medicare_withheld: number
  notes: string | null
  created_at: string
  updated_at: string
}

// Box 12 item (coded compensation items)
export interface W2Box12Item {
  code: string // Common: C, D, DD, E, G, V, W, AA, BB, etc.
  amount: number
}

// Box 14 item (other items)
export interface W2Box14Item {
  description: string
  amount: number
}

// Full W-2 form data
export interface W2Form {
  id: number
  year: number

  // Employer info
  employer_name: string
  employer_ein: string | null

  // Box 1-6: Federal wages and withholding
  wages_tips_compensation: number         // Box 1
  federal_income_tax_withheld: number     // Box 2
  social_security_wages: number           // Box 3
  social_security_tax_withheld: number    // Box 4
  medicare_wages: number                  // Box 5
  medicare_tax_withheld: number           // Box 6

  // Box 7-11: Additional compensation
  social_security_tips: number            // Box 7
  allocated_tips: number                  // Box 8
  dependent_care_benefits: number         // Box 10
  nonqualified_plans: number              // Box 11

  // Box 12: Coded items
  box_12_items: W2Box12Item[]

  // Box 13: Checkboxes
  is_statutory_employee: boolean
  has_retirement_plan: boolean
  has_third_party_sick_pay: boolean

  // Box 14: Other items
  box_14_items: W2Box14Item[]

  // State tax info (Box 15-17)
  state_code: string | null
  state_employer_id: string | null
  state_wages: number
  state_income_tax_withheld: number

  // Local tax info (Box 18-20)
  local_wages: number
  local_income_tax_withheld: number
  locality_name: string | null

  // Additional state
  state_code_2: string | null
  state_employer_id_2: string | null
  state_wages_2: number
  state_income_tax_2: number

  notes: string | null
  created_at: string
  updated_at: string
}

// W-2 Box 12 code descriptions
export const W2_BOX_12_CODES: Record<string, string> = {
  A: 'Uncollected SS/RRTA tax on tips',
  B: 'Uncollected Medicare tax on tips',
  C: 'Taxable group-term life insurance over $50k',
  D: '401(k) elective deferrals',
  E: '403(b) elective deferrals',
  F: '408(k)(6) SEP contributions',
  G: '457(b) deferred compensation',
  H: '501(c)(18)(D) tax-exempt contributions',
  J: 'Nontaxable sick pay',
  K: '20% excise tax on golden parachutes',
  L: 'Substantiated employee business expense reimbursements',
  M: 'Uncollected SS/RRTA tax on group-term life insurance',
  N: 'Uncollected Medicare tax on group-term life insurance',
  P: 'Excludable moving expense reimbursements',
  Q: 'Nontaxable combat pay',
  R: 'Employer HSA contributions',
  S: 'SIMPLE contributions',
  T: 'Adoption benefits',
  V: 'Income from exercise of nonstatutory stock options (RSU)',
  W: 'Employer HSA contributions',
  Y: 'Deferrals under 409A nonqualified deferred compensation',
  Z: 'Income under 409A nonqualified deferred compensation',
  AA: 'Roth 401(k) contributions',
  BB: 'Roth 403(b) contributions',
  DD: 'Cost of employer-sponsored health coverage',
  EE: 'Roth contributions under 457(b)',
  FF: 'Permitted benefits under qualified small employer HRA',
  GG: 'Income from qualified equity grants under 83(i)',
  HH: 'Aggregate deferrals under 83(i)',
}

// Cash Balances (legacy - individual snapshots)
export interface CashBalance {
  id: number
  date: string
  balance: number
  account_name: string
  notes: string | null
  created_at: string
}

// Cash Accounts
export type CashAccountType = 'checking' | 'savings' | 'money_market' | 'other'

export interface CashAccount {
  id: number
  name: string
  account_type: CashAccountType
  institution: string | null
  is_active: boolean
  is_default: boolean
  display_order: number
  created_at: string
  updated_at: string
}

// Monthly Cash Balances
export interface MonthlyCashBalance {
  id: number
  cash_account_id: number
  year: number
  month: number
  balance: number
  created_at: string
  updated_at: string
}

// Credit Card Spending
export interface CreditCardSpending {
  id: number
  credit_card_id: number
  year: number
  month: number
  amount: number
  statement_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreditCardSpendingWithCard extends CreditCardSpending {
  card_name: string
}

// Holdings
export interface Holding {
  id: number
  account_id: number
  security_id: number
  date: string
  value: number
  shares: number | null
  cost_basis: number | null
  created_at: string
}

export interface HoldingWithDetails extends Holding {
  account_name: string
  security_symbol: string
  security_name: string
  asset_class_name: string | null
}

// Cash Flows
export type FlowType = 'contribution' | 'withdrawal' | 'dividend' | 'interest'

export interface CashFlow {
  id: number
  account_id: number
  date: string
  amount: number
  flow_type: FlowType
  description: string | null
  created_at: string
}

export interface CashFlowWithAccount extends CashFlow {
  account_name: string
}

// Portfolio Snapshots
export interface PortfolioSnapshot {
  id: number
  account_id: number | null
  date: string
  total_value: number
  created_at: string
}

// Settings
export interface Setting {
  key: string
  value: string
  updated_at: string
}

// Return Calculations
export interface ReturnMetrics {
  simpleReturn: number
  timeWeightedReturn: number
  moneyWeightedReturn: number
  annualizedReturn: number
  startDate: string
  endDate: string
  startValue: number
  endValue: number
  netCashFlows: number
}

// Allocation
export interface AllocationItem {
  assetClass: string
  currentValue: number
  currentAllocation: number
  targetAllocation: number
  difference: number
  action: 'buy' | 'sell' | 'hold'
  actionAmount: number
}

// Cash Health
export interface CashHealthMetrics {
  totalCash: number
  monthlyExpenseAverage: number
  monthsCovered: number
  targetMonths: number
  status: 'healthy' | 'warning' | 'critical'
}

// Spending Statistics
export interface SpendingStats {
  average: number
  median: number
  min: number
  max: number
  total: number
  count: number
}

// Monthly spending for trends
export interface MonthlySpending {
  year: number
  month: number
  amount: number
}

// Year over year comparison
export interface YoYComparison {
  month: number
  currentYear: number
  previousYear: number
  change: number
  changePercent: number
}

// Fixed Expenses (recurring monthly)
export interface FixedExpense {
  id: number
  name: string
  amount: number
  is_active: boolean
  display_order: number
  created_at: string
  updated_at: string
}

// Monthly Snapshot (cash flow data per month)
export interface MonthlySnapshot {
  id: number
  year: number
  month: number
  checking_balance: number
  transfers: number
  checking_desired_end: number
  checking_payment: number
  savings_payment: number
  notes: string | null
  created_at: string
  updated_at: string
}

// Full monthly cash flow view (combines all data for a month)
export interface MonthlyCashFlow {
  year: number
  month: number
  cardBalances: {
    cardId: number
    cardName: string
    balance: number
  }[]
  totalCredit: number
  checkingBalance: number
  transfers: number
  fixedExpenses: {
    name: string
    amount: number
  }[]
  totalFixedExpenses: number
  checkingDesiredEnd: number
  availableChecking: number
  checkingPayment: number
  savingsPayment: number
}

// Pay Statement Types
export type PaySourceType = 'adp' | 'manual' | 'other'

export type PayItemCategoryCode =
  | 'earnings'
  | 'statutory_tax'
  | 'pretax_deduction'
  | 'posttax_deduction'
  | 'employer_benefit'
  | 'adjustment'
  | 'rsu_withholding' // Informational only - not stored in DB, excluded from deduction totals

export interface PayItemCategory {
  id: number
  code: PayItemCategoryCode
  name: string
  display_order: number
  created_at: string
}

export interface PayItemCode {
  id: number
  category_id: number
  code: string
  name: string
  aliases: string | null
  created_at: string
}

export interface PayStatement {
  id: number
  period_start: string
  period_end: string
  pay_date: string
  source_type: PaySourceType
  source_file_hash: string | null
  gross_earnings: number
  total_taxes: number
  total_deductions: number
  employer_benefits: number
  net_pay: number
  ytd_gross_earnings: number | null
  ytd_total_taxes: number | null
  ytd_total_deductions: number | null
  ytd_net_pay: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PayStatementItem {
  id: number
  pay_statement_id: number
  category_id: number
  item_code: string
  item_name: string
  current_amount: number
  ytd_amount: number | null
  hours: number | null
  rate: number | null
  created_at: string
}

export interface PayStatementItemWithCategory extends PayStatementItem {
  category_code: PayItemCategoryCode
  category_name: string
}

export interface PayStatementDeposit {
  id: number
  pay_statement_id: number
  account_type: string
  account_last4: string | null
  amount: number
  created_at: string
}

export interface PayStatementWithItems extends PayStatement {
  items: PayStatementItemWithCategory[]
  deposits: PayStatementDeposit[]
}

// Parsed pay statement from PDF (before saving to DB)
export interface ParsedPayStatement {
  periodStart: string
  periodEnd: string
  payDate: string
  sourceType: PaySourceType
  grossEarnings: number
  totalTaxes: number
  totalDeductions: number
  employerBenefits: number
  netPay: number
  ytdGrossEarnings?: number
  ytdTotalTaxes?: number
  ytdTotalDeductions?: number
  ytdNetPay?: number
  items: ParsedPayItem[]
  deposits: ParsedDeposit[]
}

export interface ParsedPayItem {
  categoryCode: PayItemCategoryCode
  itemCode: string
  itemName: string
  currentAmount: number
  ytdAmount?: number
  hours?: number
  rate?: number
}

export interface ParsedDeposit {
  accountType: string
  accountLast4?: string
  amount: number
}

// Annual pay summary
export interface AnnualPaySummary {
  year: number
  totalGrossEarnings: number
  totalTaxes: number
  totalDeductions: number
  totalEmployerBenefits: number
  totalNetPay: number
  statementCount: number
  byCategory: {
    earnings: { [code: string]: number }
    taxes: { [code: string]: number }
    pretaxDeductions: { [code: string]: number }
    posttaxDeductions: { [code: string]: number }
    employerBenefits: { [code: string]: number }
    adjustments: { [code: string]: number }
  }
}

// YTD summary
export interface YtdPaySummary {
  year: number
  asOfDate: string
  grossEarnings: number
  totalTaxes: number
  totalDeductions: number
  employerBenefits: number
  netPay: number
  statementCount: number
}
