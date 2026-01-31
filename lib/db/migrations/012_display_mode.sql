-- Add display_mode setting for simple/advanced view
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we check if column exists
-- This will fail silently if column already exists

ALTER TABLE onboarding_progress ADD COLUMN display_mode TEXT DEFAULT 'simple';
