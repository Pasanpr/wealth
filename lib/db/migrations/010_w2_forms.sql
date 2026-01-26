-- Full W-2 form data for tax tracking
-- Replaces the RSU-specific w2 table with comprehensive W-2 storage

CREATE TABLE IF NOT EXISTS w2_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,

  -- Employer info
  employer_name TEXT NOT NULL,
  employer_ein TEXT,

  -- Box 1-6: Federal wages and withholding
  wages_tips_compensation REAL NOT NULL DEFAULT 0,        -- Box 1
  federal_income_tax_withheld REAL NOT NULL DEFAULT 0,    -- Box 2
  social_security_wages REAL NOT NULL DEFAULT 0,          -- Box 3
  social_security_tax_withheld REAL NOT NULL DEFAULT 0,   -- Box 4
  medicare_wages REAL NOT NULL DEFAULT 0,                 -- Box 5
  medicare_tax_withheld REAL NOT NULL DEFAULT 0,          -- Box 6

  -- Box 7-11: Additional compensation
  social_security_tips REAL DEFAULT 0,                    -- Box 7
  allocated_tips REAL DEFAULT 0,                          -- Box 8
  dependent_care_benefits REAL DEFAULT 0,                 -- Box 10
  nonqualified_plans REAL DEFAULT 0,                      -- Box 11

  -- Box 12: Coded items (stored as JSON for flexibility)
  -- Common codes: C (life insurance), D (401k), DD (health insurance), V (RSU income), W (HSA)
  box_12_items TEXT DEFAULT '[]',  -- JSON array of {code, amount} objects

  -- Box 13: Checkboxes
  is_statutory_employee INTEGER DEFAULT 0,
  has_retirement_plan INTEGER DEFAULT 0,
  has_third_party_sick_pay INTEGER DEFAULT 0,

  -- Box 14: Other items (stored as JSON)
  box_14_items TEXT DEFAULT '[]',  -- JSON array of {description, amount} objects

  -- State tax info (Box 15-17) - primary state
  state_code TEXT,
  state_employer_id TEXT,
  state_wages REAL DEFAULT 0,
  state_income_tax_withheld REAL DEFAULT 0,

  -- Local tax info (Box 18-20)
  local_wages REAL DEFAULT 0,
  local_income_tax_withheld REAL DEFAULT 0,
  locality_name TEXT,

  -- Additional state (some W-2s have two states)
  state_code_2 TEXT,
  state_employer_id_2 TEXT,
  state_wages_2 REAL DEFAULT 0,
  state_income_tax_2 REAL DEFAULT 0,

  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for year and employer lookup
CREATE INDEX IF NOT EXISTS idx_w2_forms_year ON w2_forms(year);
CREATE INDEX IF NOT EXISTS idx_w2_forms_employer ON w2_forms(employer_name);

-- Unique constraint: one W-2 per employer per year
CREATE UNIQUE INDEX IF NOT EXISTS idx_w2_forms_year_employer ON w2_forms(year, employer_name);
