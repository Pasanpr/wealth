-- W-2 RSU data for tax reconciliation
-- Tracks RSU-related income and withholding from W-2

CREATE TABLE IF NOT EXISTS rsu_w2_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  total_rsu_income REAL NOT NULL, -- RSU ordinary income (vest value)
  federal_withheld REAL NOT NULL DEFAULT 0,
  state_withheld REAL NOT NULL DEFAULT 0,
  social_security_withheld REAL NOT NULL DEFAULT 0,
  medicare_withheld REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for year lookup
CREATE INDEX IF NOT EXISTS idx_rsu_w2_year ON rsu_w2_data(year);
