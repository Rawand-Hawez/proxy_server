-- MLI Operations Schema Cleanup Migration
-- Purpose: Remove old/duplicate columns and ensure clean schema
-- Date: 2025-11-17

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: Create backup of current data
-- ============================================================================
CREATE TEMPORARY TABLE mli_ops_programs_backup AS
SELECT * FROM mli_ops_programs;

-- ============================================================================
-- STEP 2: Drop the old table
-- ============================================================================
DROP TABLE mli_ops_programs;

-- ============================================================================
-- STEP 3: Create clean table with final schema
-- ============================================================================
CREATE TABLE mli_ops_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program TEXT NOT NULL UNIQUE,
  number_of_participants INTEGER,
  male_participants INTEGER,
  female_participants INTEGER,
  cash_revenue REAL,
  non_monetary_revenue REAL,
  total_revenue REAL,
  program_cost REAL,
  avg_content_rating REAL,
  avg_delivery_rating REAL,
  avg_overall_rating REAL,
  participant_fee REAL,
  status TEXT DEFAULT 'planned',
  start_date TEXT,
  end_date TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STEP 4: Migrate data from backup to new table
-- ============================================================================
INSERT INTO mli_ops_programs (
  id,
  program,
  number_of_participants,
  male_participants,
  female_participants,
  cash_revenue,
  non_monetary_revenue,
  total_revenue,
  program_cost,
  avg_content_rating,
  avg_delivery_rating,
  avg_overall_rating,
  participant_fee,
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
  -- Calculate number_of_participants from male + female if not already set
  COALESCE(
    number_of_participants,
    (COALESCE(male_participants, 0) + COALESCE(female_participants, 0))
  ),
  male_participants,
  female_participants,
  cash_revenue,
  non_monetary_revenue,
  -- Use total_revenue if set, otherwise computed_revenue, otherwise calculate from cash + non_monetary
  COALESCE(total_revenue, computed_revenue, (COALESCE(cash_revenue, 0) + COALESCE(non_monetary_revenue, 0))),
  program_cost,
  avg_content_rating,
  avg_delivery_rating,
  avg_overall_rating,
  participant_fee,
  COALESCE(status, 'planned'),
  start_date,
  end_date,
  notes,
  created_at,
  updated_at
FROM mli_ops_programs_backup;

-- ============================================================================
-- STEP 5: Create indexes for performance
-- ============================================================================
CREATE INDEX idx_mli_ops_programs_status ON mli_ops_programs(status);
CREATE INDEX idx_mli_ops_programs_dates ON mli_ops_programs(start_date, end_date);
CREATE INDEX idx_mli_ops_programs_revenue ON mli_ops_programs(total_revenue);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Show the new schema
.schema mli_ops_programs

-- Count records
SELECT COUNT(*) as total_programs FROM mli_ops_programs;

-- Show sample data
SELECT
  id,
  program,
  number_of_participants,
  male_participants,
  female_participants,
  cash_revenue,
  non_monetary_revenue,
  total_revenue,
  program_cost,
  status
FROM mli_ops_programs
LIMIT 5;
