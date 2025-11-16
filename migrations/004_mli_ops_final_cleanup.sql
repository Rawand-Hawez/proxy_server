-- MLI Operations Database Migration - Remove Duplicate Fields (SQLite Compatible)
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
-- STEP 1: Backup and create new clean table
-- ============================================================================

-- Create backup of original data
CREATE TEMPORARY TABLE programs_backup AS SELECT * FROM programs;

-- Drop the original table
DROP TABLE programs;

-- Create new clean table with proper schema
CREATE TABLE programs (
    program TEXT PRIMARY KEY,
    number_of_participants INTEGER,
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
-- STEP 2: Migrate data from backup to new table
-- ============================================================================

-- Insert data with proper column mapping
INSERT INTO programs (
    program,
    number_of_participants,
    cash_revenue,
    non_monetary_revenue,
    computed_revenue,
    participant_fee,
    status,
    start_date,
    end_date
)
SELECT 
    program,
    CAST(number_of_participants AS INTEGER),
    total_revenue_input,  -- Map total_revenue_input to cash_revenue
    non_monetary_revenue,
    COALESCE(total_revenue_input, 0) + COALESCE(non_monetary_revenue, 0),  -- computed_revenue
    participant_fee,
    status,
    start_date,
    end_date
FROM programs_backup;

-- ============================================================================
-- STEP 3: Calculate profit and profit margin
-- ============================================================================

UPDATE programs
SET profit = computed_revenue - COALESCE(0, 0),
    profit_margin = CASE 
        WHEN computed_revenue > 0 THEN (computed_revenue - COALESCE(0, 0)) / computed_revenue
        ELSE NULL
    END
WHERE computed_revenue IS NOT NULL;

-- ============================================================================
-- STEP 4: Add male/female participant counts from backup data
-- ============================================================================

-- We need to manually map the male/female data since we can't add columns after table creation in SQLite
-- Let's add them with a small modification to the insert

-- Recreate table with male_participants and female_participants
DROP TABLE programs;

CREATE TABLE programs (
    program TEXT PRIMARY KEY,
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

-- Insert data with all mappings including male/female participant counts
INSERT INTO programs (
    program,
    number_of_participants,
    male_participants,
    female_participants,
    cash_revenue,
    non_monetary_revenue,
    computed_revenue,
    participant_fee,
    status,
    start_date,
    end_date
)
SELECT 
    pb.program,
    CAST(pb.number_of_participants AS INTEGER),
    CAST(pb.male AS INTEGER),
    CAST(pb.female AS INTEGER),
    pb.total_revenue_input,  -- Map total_revenue_input to cash_revenue
    pb.non_monetary_revenue,
    COALESCE(pb.total_revenue_input, 0) + COALESCE(pb.non_monetary_revenue, 0),  -- computed_revenue
    pb.participant_fee,
    pb.status,
    pb.start_date,
    pb.end_date
FROM programs_backup pb;

-- ============================================================================
-- STEP 5: Calculate profit and profit margin for final table
-- ============================================================================

UPDATE programs
SET profit = computed_revenue - COALESCE(0, 0),
    profit_margin = CASE 
        WHEN computed_revenue > 0 THEN (computed_revenue - COALESCE(0, 0)) / computed_revenue
        ELSE NULL
    END
WHERE computed_revenue IS NOT NULL;

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
FROM programs;