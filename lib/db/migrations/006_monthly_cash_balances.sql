-- Cash accounts (checking, savings, etc.)
CREATE TABLE IF NOT EXISTS cash_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL DEFAULT 'checking' CHECK (account_type IN ('checking', 'savings', 'money_market', 'other')),
  institution TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monthly cash balance snapshots (end of month balances)
CREATE TABLE IF NOT EXISTS monthly_cash_balances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cash_account_id INTEGER NOT NULL REFERENCES cash_accounts(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  balance REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(cash_account_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_cash_balances_year_month ON monthly_cash_balances(year, month);
