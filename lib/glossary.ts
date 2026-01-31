// Financial terms glossary with plain-language definitions
// Used by TermTooltip component and Glossary page

export interface GlossaryEntry {
  term: string
  definition: string
  example?: string
  category: 'investing' | 'accounts' | 'taxes' | 'cash' | 'returns'
}

export const glossary: Record<string, GlossaryEntry> = {
  // Investing Terms
  'asset-allocation': {
    term: 'Asset Allocation',
    definition: 'How your money is divided among different types of investments like stocks, bonds, and cash.',
    example: 'If you have $10,000 invested with $6,000 in stocks and $4,000 in bonds, your allocation is 60% stocks, 40% bonds.',
    category: 'investing',
  },
  'rebalancing': {
    term: 'Rebalancing',
    definition: 'Adjusting your investments back to your target mix when they drift too far from your plan.',
    example: 'If your target is 60% stocks but they grew to 70%, you would sell some stocks and buy bonds to get back to 60%.',
    category: 'investing',
  },
  'threshold': {
    term: 'Rebalance Threshold',
    definition: 'The percentage your investments can drift from your target before you should rebalance.',
    example: 'With a 5% threshold and 60% stock target, you would rebalance when stocks hit 65% or drop to 55%.',
    category: 'investing',
  },
  'drift': {
    term: 'Allocation Drift',
    definition: 'How far your current investment mix has moved away from your target allocation.',
    example: 'If your target is 60% stocks but you currently have 65%, your drift is +5%.',
    category: 'investing',
  },
  'holdings': {
    term: 'Holdings',
    definition: 'The investments you own in your accounts - stocks, bonds, mutual funds, ETFs, etc.',
    category: 'investing',
  },
  'securities': {
    term: 'Securities',
    definition: 'Financial assets that can be traded, such as stocks, bonds, mutual funds, and ETFs.',
    category: 'investing',
  },
  'cost-basis': {
    term: 'Cost Basis',
    definition: 'The original price you paid for an investment, used to calculate gains or losses when you sell.',
    example: 'If you bought 10 shares at $50 each, your cost basis is $500.',
    category: 'investing',
  },
  'shares': {
    term: 'Shares',
    definition: 'Units of ownership in a fund or company. The more shares you own, the more of that investment you have.',
    category: 'investing',
  },
  'target-allocation': {
    term: 'Target Allocation',
    definition: 'The ideal percentage you want in each type of investment based on your goals and risk tolerance.',
    example: 'A moderate investor might target 60% stocks, 30% bonds, 10% cash.',
    category: 'investing',
  },
  'asset-class': {
    term: 'Asset Class',
    definition: 'A category of investments that behave similarly, such as stocks, bonds, real estate, or cash.',
    category: 'investing',
  },

  // Account Types
  '401k': {
    term: '401(k)',
    definition: 'A retirement savings account offered by employers where you can save pre-tax money. Taxes are paid when you withdraw in retirement.',
    example: 'You contribute $500/month from your paycheck before taxes, reducing your taxable income now.',
    category: 'accounts',
  },
  'ira': {
    term: 'IRA (Individual Retirement Account)',
    definition: 'A personal retirement account you open yourself with tax advantages. Traditional IRAs are pre-tax; Roth IRAs are after-tax.',
    category: 'accounts',
  },
  'roth-ira': {
    term: 'Roth IRA',
    definition: 'A retirement account where you contribute after-tax money, but all growth and withdrawals in retirement are tax-free.',
    example: 'You pay taxes on $6,000 now, but that money can grow to $60,000+ and you pay no taxes when you withdraw it.',
    category: 'accounts',
  },
  'brokerage': {
    term: 'Brokerage Account',
    definition: 'A regular investment account with no special tax benefits. You can withdraw money anytime but pay taxes on gains.',
    category: 'accounts',
  },
  '529': {
    term: '529 Plan',
    definition: 'A tax-advantaged savings account designed for education expenses. Withdrawals for qualified education costs are tax-free.',
    example: 'Save for your child\'s college tuition and pay no taxes on the growth if used for education.',
    category: 'accounts',
  },
  'tax-advantaged': {
    term: 'Tax-Advantaged Account',
    definition: 'An account that offers tax benefits, either deferring taxes until withdrawal (401k, traditional IRA) or providing tax-free growth (Roth IRA, 529).',
    category: 'accounts',
  },

  // Return Metrics
  'simple-return': {
    term: 'Simple Return',
    definition: 'A basic calculation of how much your investment grew, accounting for any money you added or withdrew.',
    example: 'Started with $10,000, ended with $11,000, added $500 during the year = 5% return.',
    category: 'returns',
  },
  'twr': {
    term: 'Time-Weighted Return (TWR)',
    definition: 'A return calculation that removes the effect of when you added or withdrew money, showing pure investment performance.',
    example: 'Best for comparing your performance to a benchmark like the S&P 500, since it shows how the investments themselves performed.',
    category: 'returns',
  },
  'mwr': {
    term: 'Money-Weighted Return (MWR)',
    definition: 'A return calculation that considers when and how much money you added or withdrew, showing your actual dollar returns.',
    example: 'If you added money right before a big gain, your MWR will be higher than TWR. Best for understanding your personal results.',
    category: 'returns',
  },
  'irr': {
    term: 'IRR (Internal Rate of Return)',
    definition: 'Another name for Money-Weighted Return. It calculates the return that makes all your cash flows equal your ending balance.',
    category: 'returns',
  },
  'annualized-return': {
    term: 'Annualized Return',
    definition: 'Your return expressed as a yearly rate, making it easy to compare returns across different time periods.',
    example: 'A 10% return over 6 months equals about 21% annualized.',
    category: 'returns',
  },
  'ytd-return': {
    term: 'YTD Return (Year-to-Date)',
    definition: 'How much your investments have grown or shrunk since January 1st of the current year.',
    category: 'returns',
  },

  // Tax Terms
  'effective-tax-rate': {
    term: 'Effective Tax Rate',
    definition: 'The actual percentage of your total income that goes to taxes after all deductions and credits.',
    example: 'If you earned $100,000 and paid $18,000 in federal taxes, your effective rate is 18%.',
    category: 'taxes',
  },
  'gross-income': {
    term: 'Gross Income',
    definition: 'Your total income before any taxes or deductions are taken out.',
    category: 'taxes',
  },
  'net-pay': {
    term: 'Net Pay (Take-Home Pay)',
    definition: 'The amount you actually receive after taxes, insurance, and other deductions are subtracted from your paycheck.',
    category: 'taxes',
  },
  'rsu': {
    term: 'RSU (Restricted Stock Unit)',
    definition: 'Company stock given to employees as compensation that becomes yours (vests) over time, usually on a schedule.',
    example: 'You receive 100 RSUs that vest over 4 years - you get 25 shares each year.',
    category: 'taxes',
  },
  'vesting': {
    term: 'Vesting',
    definition: 'The process of gaining full ownership of employer-provided benefits like stock or retirement contributions over time.',
    example: 'After 1 year at your job, your 401k match becomes fully vested (yours to keep if you leave).',
    category: 'taxes',
  },
  'w2': {
    term: 'W-2 Form',
    definition: 'A tax form from your employer showing your annual wages and the taxes withheld from your paychecks.',
    category: 'taxes',
  },

  // Cash Management
  'emergency-fund': {
    term: 'Emergency Fund',
    definition: 'Cash savings set aside for unexpected expenses or income loss, typically 3-6 months of living expenses.',
    example: 'If you spend $5,000/month, a 6-month emergency fund would be $30,000.',
    category: 'cash',
  },
  'cash-reserves': {
    term: 'Cash Reserves',
    definition: 'Money kept in easily accessible accounts (checking, savings) for emergencies and near-term expenses.',
    category: 'cash',
  },
  'months-covered': {
    term: 'Months of Expenses Covered',
    definition: 'How many months you could pay your bills using only your cash savings if your income stopped.',
    example: 'With $15,000 saved and $3,000 monthly expenses, you have 5 months covered.',
    category: 'cash',
  },
  'monthly-expenses': {
    term: 'Monthly Expenses',
    definition: 'The average amount you spend each month on all bills, necessities, and discretionary spending.',
    category: 'cash',
  },
  'fixed-expenses': {
    term: 'Fixed Expenses',
    definition: 'Bills that stay the same each month, like rent, mortgage, car payments, and subscriptions.',
    category: 'cash',
  },
  'net-worth': {
    term: 'Net Worth',
    definition: 'The total value of everything you own (assets) minus everything you owe (debts).',
    example: 'If you have $50,000 in savings and investments but owe $20,000, your net worth is $30,000.',
    category: 'cash',
  },
}

// Helper to get all terms in a category
export function getTermsByCategory(category: GlossaryEntry['category']): GlossaryEntry[] {
  return Object.values(glossary).filter(entry => entry.category === category)
}

// Helper to search terms
export function searchGlossary(query: string): GlossaryEntry[] {
  const lowerQuery = query.toLowerCase()
  return Object.values(glossary).filter(
    entry =>
      entry.term.toLowerCase().includes(lowerQuery) ||
      entry.definition.toLowerCase().includes(lowerQuery)
  )
}

// Category labels for display
export const categoryLabels: Record<GlossaryEntry['category'], string> = {
  investing: 'Investing',
  accounts: 'Account Types',
  taxes: 'Taxes & Income',
  cash: 'Cash Management',
  returns: 'Returns & Performance',
}
