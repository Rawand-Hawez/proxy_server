-- MLI Operations Schema Cleanup Migration
-- Purpose: Remove deprecated fields that have been successfully migrated
-- Date: 2025-11-16
--
-- This migration removes the old, redundant columns after confirming data migration
-- Only run this after verifying that the previous migration completed successfully

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: Verify data migration was successful
-- ============================================================================

-- Check if new fields have been populated correctly
-- This should return 0 rows if migration was successful
SELECT 'Verification: Check for NULL values in critical new fields' as check_name;
SELECT COUNT(*) as null_count 
FROM mli_ops_programs 
WHERE male_participants IS NULL AND male IS NOT NULL;

SELECT 'Verification: Check revenue mapping' as check_name;
SELECT COUNT(*) as revenue_issues
FROM mli_ops_programs 
WHERE (cash_revenue IS NULL AND total_revenue_input IS NOT NULL)
   OR (total_revenue IS NULL AND (cash_revenue IS NOT NULL OR non_monetary_revenue IS NOT NULL));

-- ============================================================================
-- STEP 2: Remove deprecated participant columns
-- ============================================================================

-- Drop old male/female columns (replaced by male_participants/female_participants)
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS male;
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS female;

-- ============================================================================
-- STEP 3: Remove deprecated trainer columns
-- ============================================================================

-- Drop old trainer count columns (replaced by trainer assignments)
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS trainers;
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS local_trainer;
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS expat_trainer;

-- ============================================================================
-- STEP 4: Remove deprecated revenue columns
-- ============================================================================

-- Drop old revenue columns (replaced by cash_revenue/total_revenue)
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS total_revenue_input;
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS actual_revenue;

-- ============================================================================
-- STEP 5: Remove module-level columns that should be at program level
-- ============================================================================

-- These are now handled at the module level
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS duration_days;
ALTER TABLE mli_ops_programs DROP COLUMN IF EXISTS unit_price;

-- ============================================================================
-- STEP 6: Add computed revenue fields if not already present
-- ============================================================================

-- Add computed revenue and profit fields for business logic
ALTER TABLE mli_ops_programs ADD COLUMN IF NOT EXISTS computed_revenue REAL;
ALTER TABLE mli_ops_programs ADD COLUMN IF NOT EXISTS revenue_overridden INTEGER DEFAULT 0;
ALTER TABLE mli_ops_programs ADD COLUMN IF NOT EXISTS profit REAL;
ALTER TABLE mli_ops_programs ADD COLUMN IF NOT EXISTS profit_margin REAL;

-- ============================================================================
-- STEP 7: Update computed fields
-- ============================================================================

-- Update computed_revenue (if not overridden, it's the same as total_revenue)
UPDATE mli_ops_programs
SET computed_revenue = total_revenue
WHERE revenue_overridden = 0 OR revenue_overridden IS NULL;

-- Update profit and profit margin
UPDATE mli_ops_programs
SET profit = total_revenue - COALESCE(program_cost, 0),
    profit_margin = CASE 
        WHEN total_revenue > 0 THEN (total_revenue - COALESCE(program_cost, 0)) / total_revenue
        ELSE NULL
    END
WHERE total_revenue IS NOT NULL;

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Show final schema
.schema mli_ops_programs

-- Show sample data to verify migration
SELECT id, program, male_participants, female_participants, 
       cash_revenue, non_monetary_revenue, total_revenue, 
       profit, profit_margin
FROM mli_ops_programs 
LIMIT 5;