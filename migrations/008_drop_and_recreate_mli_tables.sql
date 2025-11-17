-- MLI Operations Complete Database Reset
-- Purpose: Drop all MLI tables and recreate with clean schema
-- Date: 2025-11-17
-- WARNING: This will delete ALL MLI data!

BEGIN TRANSACTION;

-- ============================================================================
-- STEP 1: Drop all MLI tables
-- ============================================================================
DROP TABLE IF EXISTS mli_ops_program_surveys;
DROP TABLE IF EXISTS mli_ops_module_trainers;
DROP TABLE IF EXISTS mli_ops_program_modules;
DROP TABLE IF EXISTS mli_ops_trainers;
DROP TABLE IF EXISTS mli_ops_programs;

-- ============================================================================
-- STEP 2: Create clean mli_ops_programs table
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
-- STEP 3: Create mli_ops_trainers table
-- ============================================================================
CREATE TABLE mli_ops_trainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  trainer_type TEXT NOT NULL CHECK (trainer_type IN ('local', 'expat')),
  email TEXT,
  phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- STEP 4: Create mli_ops_program_modules table
-- ============================================================================
CREATE TABLE mli_ops_program_modules (
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

-- ============================================================================
-- STEP 5: Create mli_ops_module_trainers table
-- ============================================================================
CREATE TABLE mli_ops_module_trainers (
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

-- ============================================================================
-- STEP 6: Create mli_ops_program_surveys table
-- ============================================================================
CREATE TABLE mli_ops_program_surveys (
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
-- STEP 7: Create indexes for performance
-- ============================================================================
-- Programs indexes
CREATE INDEX idx_mli_ops_programs_status ON mli_ops_programs(status);
CREATE INDEX idx_mli_ops_programs_dates ON mli_ops_programs(start_date, end_date);
CREATE INDEX idx_mli_ops_programs_revenue ON mli_ops_programs(total_revenue);

-- Modules indexes
CREATE INDEX idx_modules_program_id ON mli_ops_program_modules(program_id);

-- Module-Trainers indexes
CREATE INDEX idx_module_trainers_module_id ON mli_ops_module_trainers(module_id);
CREATE INDEX idx_module_trainers_trainer_id ON mli_ops_module_trainers(trainer_id);

-- Surveys indexes
CREATE INDEX idx_surveys_program_id ON mli_ops_program_surveys(program_id);

-- Trainers indexes
CREATE INDEX idx_trainers_type ON mli_ops_trainers(trainer_type);
CREATE INDEX idx_trainers_active ON mli_ops_trainers(active);

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
.echo on

SELECT '=== MLI TABLES RECREATED SUCCESSFULLY ===' as message;

.schema mli_ops_programs
.schema mli_ops_trainers
.schema mli_ops_program_modules
.schema mli_ops_module_trainers
.schema mli_ops_program_surveys

SELECT 'Programs count: ' || COUNT(*) FROM mli_ops_programs;
SELECT 'Trainers count: ' || COUNT(*) FROM mli_ops_trainers;
SELECT 'Modules count: ' || COUNT(*) FROM mli_ops_program_modules;
SELECT 'Surveys count: ' || COUNT(*) FROM mli_ops_program_surveys;
