-- MLI Operations Schema Migration
-- Purpose: Migrate from simple trainer counts to full relational model
-- Date: 2025-11-16
--
-- This migration:
-- 1. Adds new columns to mli_ops_programs
-- 2. Creates new tables for modules, trainers, assignments, and surveys
-- 3. Migrates existing data to new columns
-- 4. Marks old columns as deprecated (but doesn't drop them for safety)

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: Add new columns to mli_ops_programs
-- ============================================================================

-- Add renamed participant columns
ALTER TABLE mli_ops_programs ADD COLUMN male_participants INTEGER;
ALTER TABLE mli_ops_programs ADD COLUMN female_participants INTEGER;

-- Add new revenue columns
ALTER TABLE mli_ops_programs ADD COLUMN cash_revenue REAL;
ALTER TABLE mli_ops_programs ADD COLUMN total_revenue REAL;

-- Add survey rating columns
ALTER TABLE mli_ops_programs ADD COLUMN avg_content_rating REAL;
ALTER TABLE mli_ops_programs ADD COLUMN avg_delivery_rating REAL;
ALTER TABLE mli_ops_programs ADD COLUMN avg_overall_rating REAL;

-- ============================================================================
-- STEP 2: Migrate existing data to new columns
-- ============================================================================

-- Migrate participant data
UPDATE mli_ops_programs
SET male_participants = CAST(male AS INTEGER)
WHERE male IS NOT NULL;

UPDATE mli_ops_programs
SET female_participants = CAST(female AS INTEGER)
WHERE female IS NOT NULL;

-- Migrate revenue data
-- Map total_revenue_input -> cash_revenue (this was the main revenue field)
UPDATE mli_ops_programs
SET cash_revenue = total_revenue_input
WHERE total_revenue_input IS NOT NULL;

-- Compute total_revenue = cash_revenue + non_monetary_revenue
UPDATE mli_ops_programs
SET total_revenue = COALESCE(cash_revenue, 0) + COALESCE(non_monetary_revenue, 0)
WHERE cash_revenue IS NOT NULL OR non_monetary_revenue IS NOT NULL;

-- If cash_revenue is NULL but actual_revenue exists, use it
UPDATE mli_ops_programs
SET cash_revenue = actual_revenue,
    total_revenue = actual_revenue
WHERE cash_revenue IS NULL AND actual_revenue IS NOT NULL;

-- ============================================================================
-- STEP 3: Create new tables
-- ============================================================================

-- 3.1 Program Modules
CREATE TABLE IF NOT EXISTS mli_ops_program_modules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_days REAL,
  unit_price REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id) REFERENCES mli_ops_programs(id) ON DELETE CASCADE,
  UNIQUE (program_id, name)
);

-- 3.2 Trainers
CREATE TABLE IF NOT EXISTS mli_ops_trainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  trainer_type TEXT NOT NULL CHECK (trainer_type IN ('local', 'expat')),
  email TEXT,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3.3 Module-Trainer Assignments
CREATE TABLE IF NOT EXISTS mli_ops_module_trainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  module_id INTEGER NOT NULL,
  trainer_id INTEGER NOT NULL,
  role TEXT,
  trainer_fee REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (module_id) REFERENCES mli_ops_program_modules(id) ON DELETE CASCADE,
  FOREIGN KEY (trainer_id) REFERENCES mli_ops_trainers(id) ON DELETE RESTRICT,
  UNIQUE (module_id, trainer_id)
);

-- 3.4 Program Surveys
CREATE TABLE IF NOT EXISTS mli_ops_program_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  respondent_type TEXT,
  content_rating INTEGER CHECK (content_rating BETWEEN 1 AND 5),
  delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5),
  overall_rating REAL,
  comments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id) REFERENCES mli_ops_programs(id) ON DELETE CASCADE
);

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_modules_program_id ON mli_ops_program_modules(program_id);
CREATE INDEX IF NOT EXISTS idx_module_trainers_module_id ON mli_ops_module_trainers(module_id);
CREATE INDEX IF NOT EXISTS idx_module_trainers_trainer_id ON mli_ops_module_trainers(trainer_id);
CREATE INDEX IF NOT EXISTS idx_surveys_program_id ON mli_ops_program_surveys(program_id);
CREATE INDEX IF NOT EXISTS idx_trainers_type ON mli_ops_trainers(trainer_type);
CREATE INDEX IF NOT EXISTS idx_trainers_active ON mli_ops_trainers(active);

COMMIT;

-- ============================================================================
-- NOTES ON DEPRECATED COLUMNS
-- ============================================================================
-- The following columns in mli_ops_programs are now DEPRECATED but NOT dropped:
-- - male (replaced by male_participants)
-- - female (replaced by female_participants)
-- - trainers (replaced by trainer assignments in mli_ops_module_trainers)
-- - local_trainer (replaced by trainer assignments with trainer_type='local')
-- - expat_trainer (replaced by trainer assignments with trainer_type='expat')
-- - total_revenue_input (replaced by cash_revenue)
-- - actual_revenue (replaced by total_revenue)
-- - duration_days (will be moved to module level)
-- - unit_price (will be moved to module level)
--
-- These columns are kept for backward compatibility and data safety.
-- They can be dropped in a future migration after confirming all data is migrated.
