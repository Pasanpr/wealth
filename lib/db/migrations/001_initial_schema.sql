-- Asset classes for portfolio allocation (e.g., US Large Cap, Bonds)
CREATE TABLE IF NOT EXISTS asset_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  target_allocation REAL NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Account types (529, brokerage, ira, roth_ira, 401k, hsa)
CREATE TABLE IF NOT EXISTS account_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_tax_advantaged INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Individual securities/funds within asset classes
CREATE TABLE IF NOT EXISTS securities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  asset_class_id INTEGER REFERENCES asset_classes(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Investment accounts
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  account_type_id INTEGER NOT NULL REFERENCES account_types(id),
  institution TEXT,
  beneficiary TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Credit cards
CREATE TABLE IF NOT EXISTS credit_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  issuer TEXT,
  last4 TEXT,
  credit_limit REAL,
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tax profile (for RSU net proceeds calculation)
CREATE TABLE IF NOT EXISTS tax_profile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  gross_income REAL NOT NULL,
  federal_tax REAL NOT NULL,
  state_tax REAL NOT NULL,
  effective_rate REAL GENERATED ALWAYS AS ((federal_tax + state_tax) / gross_income) STORED,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Income records (salary, RSU, bonus)
CREATE TABLE IF NOT EXISTS income_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  income_type TEXT NOT NULL CHECK (income_type IN ('salary', 'rsu_vesting', 'bonus', 'other')),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RSU vesting schedule
CREATE TABLE IF NOT EXISTS rsu_vesting_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vest_date TEXT NOT NULL,
  shares REAL NOT NULL,
  grant_price REAL NOT NULL,
  grant_date TEXT NOT NULL,
  grant_id TEXT,
  is_vested INTEGER NOT NULL DEFAULT 0,
  actual_price_at_vest REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Yearly expense totals
CREATE TABLE IF NOT EXISTS yearly_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  total_amount REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cash balance snapshots
CREATE TABLE IF NOT EXISTS cash_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  balance REAL NOT NULL,
  account_name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monthly credit card spending
CREATE TABLE IF NOT EXISTS credit_card_spending (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  credit_card_id INTEGER NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  amount REAL NOT NULL,
  statement_date TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(credit_card_id, year, month)
);

-- Holdings snapshots (point-in-time values per security)
CREATE TABLE IF NOT EXISTS holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  security_id INTEGER NOT NULL REFERENCES securities(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  shares REAL,
  cost_basis REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Cash flows (contributions, withdrawals)
CREATE TABLE IF NOT EXISTS cash_flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('contribution', 'withdrawal', 'dividend', 'interest')),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Portfolio value history (for TWR/MWR)
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  total_value REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- App settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_income_records_date ON income_records(date);
CREATE INDEX IF NOT EXISTS idx_holdings_account_date ON holdings(account_id, date);
CREATE INDEX IF NOT EXISTS idx_holdings_security_date ON holdings(security_id, date);
CREATE INDEX IF NOT EXISTS idx_cash_flows_account_date ON cash_flows(account_id, date);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots(date);
CREATE INDEX IF NOT EXISTS idx_credit_card_spending_year_month ON credit_card_spending(year, month);

-- Insert default account types
INSERT OR IGNORE INTO account_types (code, name, is_tax_advantaged) VALUES
  ('529', '529 College Savings', 1),
  ('brokerage', 'Brokerage', 0),
  ('ira', 'Traditional IRA', 1),
  ('roth_ira', 'Roth IRA', 1),
  ('401k', '401(k)', 1),
  ('roth_401k', 'Roth 401(k)', 1),
  ('hsa', 'Health Savings Account', 1),
  ('other', 'Other', 0);

-- Insert default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('rebalance_threshold', '5'),
  ('monthly_expense_target', '5000'),
  ('cash_reserve_months', '6');
