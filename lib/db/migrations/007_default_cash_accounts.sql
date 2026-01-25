-- Add is_default column to cash_accounts
-- Only one account per type can be default
ALTER TABLE cash_accounts ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
