-- Onboarding progress tracking
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id INTEGER PRIMARY KEY DEFAULT 1,
  asset_classes_done INTEGER DEFAULT 0,
  securities_done INTEGER DEFAULT 0,
  accounts_done INTEGER DEFAULT 0,
  credit_cards_done INTEGER DEFAULT 0,
  import_done INTEGER DEFAULT 0,
  completed_at TEXT,
  dismissed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Insert default row
INSERT OR IGNORE INTO onboarding_progress (id) VALUES (1);

-- Add display_mode to settings for simple/advanced mode
-- Check if column exists first using pragma
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a separate migration check
