-- MLI Operations Main Database Migration - Remove Duplicate Fields
-- Database: data/proxy_server.db (mli_ops_programs table)
-- Purpose: Clean up duplicate/redundant fields in main application database
-- Date: 2025-11-16

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: Backup existing data and migrate to new schema
-- ============================================================================

-- Create backup table
CREATE TABLE mli_ops_programs_backup AS 
SELECT id, program, number_of_participants, male, female, trainers, 
       local_trainer, expat_trainer, duration_days, unit_price, 
       total_revenue_input, status, start_date, end_date, 
       participant_fee, non_monetary_revenue, actual_revenue, 
       program_cost, notes, created_at, updated_at
FROM mli_ops_programs;

-- ============================================================================
-- STEP 2: Create clean new table structure
-- ============================================================================

DROP TABLE mli_ops_programs;

CREATE TABLE mli_ops_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program TEXT NOT NULL UNIQUE,
  number_of_participants INTEGER,
  male_participants INTEGER,
  female_participants INTEGER,
  cash_revenue REAL,
  non_monetary_revenue REAL,
  computed_revenue REAL,
  revenue_overridden INTEGER DEFAULT 0,
  profit REAL,
  profit_margin REAL,
  avg_content_rating REAL,
  avg_delivery_rating REAL,
  avg_overall_rating REAL,
  participant_fee REAL,
  program_cost REAL,
  status TEXT,
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STEP 3: Migrate data from backup to new table
-- ============================================================================

INSERT INTO mli_ops_programs (
  id,
  program,
  number_of_participants,
  male_participants,
  female_participants,
  cash_revenue,
  non_monetary_revenue,
  computed_revenue,
  participant_fee,
  program_cost,
  status,
  start_date,
  end_date,
  notes,
  created_at,
  updated_at
)
SELECT 
  id,
  program,
  CAST(COALESCE(number_of_participants, 0) AS INTEGER),
  CAST(COALESCE(male, 0) AS INTEGER),
  CAST(COALESCE(female, 0) AS INTEGER),
  COALESCE(total_revenue_input, 0),  -- Map old total_revenue_input to cash_revenue
  COALESCE(non_monetary_revenue, 0),
  COALESCE(total_revenue_input, 0) + COALESCE(non_monetary_revenue, 0),  -- computed revenue
  COALESCE(participant_fee, 0),
  COALESCE(program_cost, 0),
  COALESCE(status, 'planned'),
  start_date,
  end_date,
  notes,
  COALESCE(created_at, '2025-11-16 11:19:01'),
  COALESCE(updated_at, '2025-11-16 18:48:14')
FROM mli_ops_programs_backup;

-- ============================================================================
-- STEP 4: Calculate profit and profit margin
-- ============================================================================

UPDATE mli_ops_programs
SET profit = computed_revenue - COALESCE(program_cost, 0),
    profit_margin = CASE 
        WHEN computed_revenue > 0 THEN (computed_revenue - COALESCE(program_cost, 0)) / computed_revenue
        ELSE NULL
    END
WHERE computed_revenue IS NOT NULL;

-- ============================================================================
-- STEP 5: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_mli_ops_programs_status ON mli_ops_programs(status);
CREATE INDEX IF NOT EXISTS idx_mli_ops_programs_dates ON mli_ops_programs(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_mli_ops_programs_revenue ON mli_ops_programs(computed_revenue);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show final schema
.schema mli_ops_programs

-- Show sample data to verify migration
SELECT 
  id,
  program,
  number_of_participants,
  male_participants,
  female_participants,
  cash_revenue,
  non_monetary_revenue,
  computed_revenue,
  profit,
  profit_margin,
  status
FROM mli_ops_programs
ORDER BY id
LIMIT 10;