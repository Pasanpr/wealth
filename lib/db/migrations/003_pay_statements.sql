-- Pay statement item categories (earnings, taxes, deductions, etc.)
CREATE TABLE IF NOT EXISTS pay_item_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert default categories
INSERT OR IGNORE INTO pay_item_categories (code, name, display_order) VALUES
  ('earnings', 'Earnings', 1),
  ('statutory_tax', 'Statutory Taxes', 2),
  ('pretax_deduction', 'Pre-Tax Deductions', 3),
  ('posttax_deduction', 'Post-Tax Deductions', 4),
  ('employer_benefit', 'Employer Benefits', 5),
  ('adjustment', 'Adjustments', 6);

-- Standard pay item codes with aliases for normalization
CREATE TABLE IF NOT EXISTS pay_item_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES pay_item_categories(id),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  aliases TEXT, -- JSON array of alternative names from ADP
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Insert common pay item codes
INSERT OR IGNORE INTO pay_item_codes (category_id, code, name, aliases) VALUES
  -- Earnings
  (1, 'REGULAR', 'Regular Salary', '["Regular","Salary","Base Pay"]'),
  (1, 'RSU_VEST', 'RSU Vesting', '["RSU","Restricted Stock","Stock Vest","RSU Vesting"]'),
  (1, 'BONUS', 'Bonus', '["Bonus","Annual Bonus","Performance Bonus"]'),
  (1, 'OVERTIME', 'Overtime', '["Overtime","OT"]'),
  (1, 'PTO', 'PTO Payout', '["PTO","Vacation Payout","PTO Payout"]'),
  -- Statutory Taxes
  (2, 'FED_TAX', 'Federal Tax', '["Federal Tax","Fed Tax","Federal Income Tax"]'),
  (2, 'STATE_TAX', 'State Tax', '["State Tax","State Income Tax"]'),
  (2, 'SOC_SEC', 'Social Security', '["Social Security","FICA SS","OASDI"]'),
  (2, 'MEDICARE', 'Medicare', '["Medicare","FICA Med"]'),
  (2, 'SDI', 'State Disability Insurance', '["SDI","State Disability","CA SDI"]'),
  -- Pre-Tax Deductions
  (3, '401K_PRETAX', '401(k) Pre-Tax', '["401K","401(k)","401k Pre-Tax","401K Pretax"]'),
  (3, '401K_ROTH', '401(k) Roth', '["401K Roth","Roth 401(k)","401k Roth"]'),
  (3, 'HSA', 'HSA Contribution', '["HSA","Health Savings","HSA Contribution"]'),
  (3, 'FSA_HEALTH', 'Health FSA', '["FSA Health","Medical FSA","Healthcare FSA"]'),
  (3, 'FSA_DEPENDENT', 'Dependent Care FSA', '["FSA Dependent","Dependent Care","DCFSA"]'),
  (3, 'MEDICAL', 'Medical Insurance', '["Medical","Health Insurance","Medical Insurance"]'),
  (3, 'DENTAL', 'Dental Insurance', '["Dental","Dental Insurance"]'),
  (3, 'VISION', 'Vision Insurance', '["Vision","Vision Insurance"]'),
  -- Post-Tax Deductions
  (4, 'AFTER_TAX_401K', 'After-Tax 401(k)', '["After Tax 401K","After-Tax 401(k)","Mega Backdoor"]'),
  (4, 'ESPP', 'ESPP', '["ESPP","Employee Stock Purchase","Stock Purchase"]'),
  (4, 'LIFE_INS', 'Life Insurance', '["Life Insurance","Life Ins","Supplemental Life"]'),
  (4, 'LTD', 'Long-Term Disability', '["LTD","Long Term Disability"]'),
  (4, 'LEGAL', 'Legal Plan', '["Legal","Legal Plan","Legal Services"]'),
  -- Employer Benefits
  (5, '401K_MATCH', '401(k) Match', '["401K Match","Employer Match","Company Match"]'),
  (5, 'HSA_MATCH', 'HSA Match', '["HSA Match","Employer HSA"]'),
  (5, 'MEDICAL_ER', 'Employer Medical', '["Employer Medical","Medical ER","Company Medical"]'),
  (5, 'DENTAL_ER', 'Employer Dental', '["Employer Dental","Dental ER","Company Dental"]'),
  (5, 'VISION_ER', 'Employer Vision', '["Employer Vision","Vision ER","Company Vision"]'),
  (5, 'LIFE_INS_ER', 'Employer Life Insurance', '["Employer Life","Life ER","Company Life"]'),
  (5, 'LTD_ER', 'Employer LTD', '["Employer LTD","LTD ER","Company LTD"]'),
  -- Adjustments (amounts added back to pay)
  (6, 'EXPENSE_REIMB', 'Expense Reimbursement', '["Expense Reimbursement","Expense Reimb","ExpenseRe","Expense Rep"]'),
  (6, 'TRAVEL_REIMB', 'Travel Reimbursement', '["Travel Reimbursement","Travel Reimb","Travel"]'),
  (6, 'MILEAGE_REIMB', 'Mileage Reimbursement', '["Mileage","Mileage Reimb","Mileage Reimbursement"]'),
  (6, 'IMPUTED_ADJ', 'Imputed Adjustment', '["Imputed","Imputed Adj","Imputed Adjustment"]');

-- Pay statements - one record per pay period
CREATE TABLE IF NOT EXISTS pay_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_start TEXT NOT NULL, -- ISO 8601 date
  period_end TEXT NOT NULL,   -- ISO 8601 date
  pay_date TEXT NOT NULL,     -- ISO 8601 date
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('adp', 'manual', 'other')),
  source_file_hash TEXT,      -- SHA-256 hash for duplicate detection
  -- Denormalized totals
  gross_earnings REAL NOT NULL DEFAULT 0,
  total_taxes REAL NOT NULL DEFAULT 0,
  total_deductions REAL NOT NULL DEFAULT 0,
  employer_benefits REAL NOT NULL DEFAULT 0,
  net_pay REAL NOT NULL DEFAULT 0,
  -- YTD values for validation
  ytd_gross_earnings REAL,
  ytd_total_taxes REAL,
  ytd_total_deductions REAL,
  ytd_net_pay REAL,
  -- Metadata
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(period_start, period_end, pay_date)
);

CREATE INDEX IF NOT EXISTS idx_pay_statements_pay_date ON pay_statements(pay_date);
CREATE INDEX IF NOT EXISTS idx_pay_statements_source_file_hash ON pay_statements(source_file_hash);

-- Pay statement line items
CREATE TABLE IF NOT EXISTS pay_statement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pay_statement_id INTEGER NOT NULL REFERENCES pay_statements(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES pay_item_categories(id),
  item_code TEXT NOT NULL,    -- Code from pay_item_codes or custom
  item_name TEXT NOT NULL,    -- Display name
  current_amount REAL NOT NULL DEFAULT 0,
  ytd_amount REAL,
  hours REAL,                 -- For hourly earnings
  rate REAL,                  -- For hourly earnings
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pay_statement_items_statement ON pay_statement_items(pay_statement_id);
CREATE INDEX IF NOT EXISTS idx_pay_statement_items_category ON pay_statement_items(category_id);

-- Direct deposit breakdown
CREATE TABLE IF NOT EXISTS pay_statement_deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pay_statement_id INTEGER NOT NULL REFERENCES pay_statements(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL, -- 'checking', 'savings', etc.
  account_last4 TEXT,         -- Last 4 digits of account
  amount REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pay_statement_deposits_statement ON pay_statement_deposits(pay_statement_id);
