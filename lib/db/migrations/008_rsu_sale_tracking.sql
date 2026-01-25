-- Add RSU sale tracking fields to support liquidation tracking
-- The existing actual_price_at_vest serves as the vest_price (FMV at vesting)

-- Sale date: when shares were sold (typically same day or next trading window)
ALTER TABLE rsu_vesting_schedule ADD COLUMN sale_date TEXT;

-- Sale price: price per share at time of sale
ALTER TABLE rsu_vesting_schedule ADD COLUMN sale_price REAL;

-- Gross proceeds: total from sale (shares × sale_price)
ALTER TABLE rsu_vesting_schedule ADD COLUMN gross_proceeds REAL;

-- Taxes withheld: amount withheld by broker (E*Trade)
ALTER TABLE rsu_vesting_schedule ADD COLUMN taxes_withheld REAL;

-- Net proceeds: what you received after taxes (gross - taxes)
ALTER TABLE rsu_vesting_schedule ADD COLUMN net_proceeds REAL;

-- Reinvested amount: portion of net proceeds reinvested in other assets
ALTER TABLE rsu_vesting_schedule ADD COLUMN reinvested_amount REAL;

-- Cash retained: portion of net proceeds kept as cash
ALTER TABLE rsu_vesting_schedule ADD COLUMN cash_retained REAL;

-- Index for querying sales by date
CREATE INDEX IF NOT EXISTS idx_rsu_sale_date ON rsu_vesting_schedule(sale_date);
