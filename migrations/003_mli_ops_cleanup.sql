-- MLI Operations Database Migration - Remove Duplicate Fields
-- Database: ./docs/data/mli_ops/programs.db
-- Purpose: Migrate from old field names to new standardized names and remove duplicates
-- Date: 2025-11-16
--
-- This migration will:
-- 1. Add new standardized column names
-- 2. Migrate data from old columns to new columns
-- 3. Remove duplicate/redundant columns
-- 4. Add computed fields for revenue calculations

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: Add new standardized columns
-- ============================================================================

-- Add renamed participant columns
ALTER TABLE programs ADD COLUMN male_participants INTEGER;
ALTER TABLE programs ADD COLUMN female_participants INTEGER;

-- Add new revenue columns  
ALTER TABLE programs ADD COLUMN cash_revenue REAL;
ALTER TABLE programs ADD COLUMN computed_revenue REAL;
ALTER TABLE programs ADD COLUMN revenue_overridden INTEGER DEFAULT 0;

-- Add survey rating columns
ALTER TABLE programs ADD COLUMN avg_content_rating REAL;
ALTER TABLE programs ADD COLUMN avg_delivery_rating REAL;
ALTER TABLE programs ADD COLUMN avg_overall_rating REAL;

-- Add profit calculation columns
ALTER TABLE programs ADD COLUMN profit REAL;
ALTER TABLE programs ADD COLUMN profit_margin REAL;

-- Add audit columns
ALTER TABLE programs ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE programs ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- ============================================================================
-- STEP 2: Migrate existing data to new columns
-- ============================================================================

-- Migrate participant data
UPDATE programs
SET male_participants = CAST(male AS INTEGER)
WHERE male IS NOT NULL;

UPDATE programs  
SET female_participants = CAST(female AS INTEGER)
WHERE female IS NOT NULL;

-- Migrate revenue data
-- Use total_revenue_input as cash_revenue (this was the main cash revenue field)
UPDATE programs
SET cash_revenue = total_revenue_input
WHERE total_revenue_input IS NOT NULL;

-- Compute total_revenue = cash_revenue + non_monetary_revenue
UPDATE programs
SET computed_revenue = COALESCE(total_revenue_input, 0) + COALESCE(non_monetary_revenue, 0)
WHERE total_revenue_input IS NOT NULL OR non_monetary_revenue IS NOT NULL;

-- If no cash revenue but has non-monetary revenue, use that as computed revenue
UPDATE programs
SET computed_revenue = non_monetary_revenue
WHERE computed_revenue IS NULL AND non_monetary_revenue IS NOT NULL;

-- Set created_at and updated_at for existing records (approximate)
UPDATE programs
SET created_at = '2025-11-16 11:19:01',
    updated_at = '2025-11-16 18:48:14';

-- Calculate profit (for programs that have both revenue and costs, if any)
-- For now, we'll assume program_cost is 0 unless specified
UPDATE programs
SET profit = computed_revenue - COALESCE(0, 0),
    profit_margin = CASE 
        WHEN computed_revenue > 0 THEN (computed_revenue - COALESCE(0, 0)) / computed_revenue
        ELSE NULL
    END
WHERE computed_revenue IS NOT NULL;

-- ============================================================================
-- STEP 3: Remove deprecated/duplicate columns
-- ============================================================================

-- Remove old participant columns (replaced by male_participants/female_participants)
ALTER TABLE programs DROP COLUMN IF EXISTS male;
ALTER TABLE programs DROP COLUMN IF EXISTS female;

-- Remove old trainer count columns (will be handled separately in future)
ALTER TABLE programs DROP COLUMN IF EXISTS trainers;
ALTER TABLE programs DROP COLUMN IF EXISTS local_trainer;
ALTER TABLE programs DROP COLUMN IF EXISTS expat_trainer;

-- Remove duplicate revenue columns (replaced by cash_revenue/computed_revenue)
ALTER TABLE programs DROP COLUMN IF EXISTS total_revenue_input;
ALTER TABLE programs DROP COLUMN IF EXISTS actual_revenue;

-- Remove module-level columns that should be handled at program level for now
ALTER TABLE programs DROP COLUMN IF EXISTS duration_days;
ALTER TABLE programs DROP COLUMN IF EXISTS unit_price;

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show the new schema
.schema programs

-- Show sample data to verify migration
SELECT 
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
FROM programs
LIMIT 5;