-- Fix duplicate detection: allow multiple pay statements on same date with different amounts
-- SQLite doesn't support ALTER TABLE to drop constraints, so we recreate the table

-- Disable foreign keys temporarily to avoid CASCADE deletes
PRAGMA foreign_keys = OFF;

-- Create new table with corrected constraint (includes gross_earnings in uniqueness)
CREATE TABLE IF NOT EXISTS pay_statements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('adp', 'manual', 'other')),
  source_file_hash TEXT,
  gross_earnings REAL NOT NULL DEFAULT 0,
  total_taxes REAL NOT NULL DEFAULT 0,
  total_deductions REAL NOT NULL DEFAULT 0,
  employer_benefits REAL NOT NULL DEFAULT 0,
  net_pay REAL NOT NULL DEFAULT 0,
  ytd_gross_earnings REAL,
  ytd_total_taxes REAL,
  ytd_total_deductions REAL,
  ytd_net_pay REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Updated constraint: include gross_earnings to allow multiple statements on same date
  -- (e.g., regular paycheck + RSU vesting on same day with different amounts)
  UNIQUE(period_start, period_end, pay_date, gross_earnings)
);

-- Copy existing data (preserving IDs for foreign key references)
INSERT OR IGNORE INTO pay_statements_new
SELECT * FROM pay_statements;

-- Drop old table
DROP TABLE IF EXISTS pay_statements;

-- Rename new table
ALTER TABLE pay_statements_new RENAME TO pay_statements;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_pay_statements_pay_date ON pay_statements(pay_date);
CREATE INDEX IF NOT EXISTS idx_pay_statements_source_file_hash ON pay_statements(source_file_hash);

-- Re-enable foreign keys
PRAGMA foreign_keys = ON;
