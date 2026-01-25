-- Add pay_statement_id to income_records for syncing with pay statements
-- This allows tracking which income records were created from pay statement imports

ALTER TABLE income_records ADD COLUMN pay_statement_id INTEGER REFERENCES pay_statements(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_income_records_pay_statement_id ON income_records(pay_statement_id);
