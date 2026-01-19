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

// RSU Vesting Schedule
export interface RsuVesting {
  id: number
  vest_date: string
  shares: number
  grant_price: number
  grant_date: string
  grant_id: string | null
  is_vested: boolean
  actual_price_at_vest: number | null
  created_at: string
  updated_at: string
}

// Yearly Expenses
export interface YearlyExpense {
  id: number
  year: number
  total_amount: number
  notes: string | null
  created_at: string
  updated_at: string
}

// Cash Balances
export interface CashBalance {
  id: number
  date: string
  balance: number
  account_name: string
  notes: string | null
  created_at: string
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
