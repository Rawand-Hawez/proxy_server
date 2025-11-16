# MLI Operations – Programs Data Model & KPIs

## 1. Purpose

This document describes the data model for **MLI Operations Programs**, including:

- Program structure (programs, modules, trainers).
- Revenue and cost modelling.
- End-of-program survey ratings.
- Key quality and profitability KPIs.

The aim is to support clear reporting on:

- **Quality** – course content and trainer delivery.
- **Profitability** – cash and non-monetary value versus program cost.

---

## 2. Business Concepts

### 2.1. Program

A **Program** is a training offering delivered by MLI. It has:

- A name (or code).
- Start and end dates.
- Participants (male and female).
- Financial outcomes (revenue and cost).
- Quality ratings based on surveys.

### 2.2. Module

A **Module** is a logical part of a program. A program can have:

- One default module (e.g. `"Main"`), or
- Multiple modules (e.g. `"Module 1: Leadership"`, `"Module 2: Communication"`).

Each module can have:

- Its own duration.
- Its own price (if applicable).
- Its own assigned trainers.

### 2.3. Trainer

A **Trainer** is an individual who delivers module content. Each trainer:

- Can be **local** or **expat**.
- Can teach different modules across different programs.

### 2.4. Survey (Program Evaluation)

At the end of a program, participants (or other stakeholders) fill out a survey to rate:

1. **Program Content** (1–5)
2. **Program Delivery** (1–5)

An overall rating can be derived or explicitly stored. Multiple survey responses are aggregated to generate average scores per program.

---

## 3. Revenue & Cost Definitions

### 3.1. Cash Revenue (`cash_revenue`)

> **All actual cash inflows** linked to a program.

Examples:

- Participant fees paid.
- Contracted training income.
- Cash grants or sponsorships specifically for the program.

### 3.2. Non-monetary Revenue (`non_monetary_revenue`)

> **Estimated monetary value** of in-kind or non-cash contributions that increase program value but are **not paid as cash** to MLI.

Examples (included):

- Partner organization provides trainers for free (trainer time is valued).
- University provides classrooms or labs for free (venue is valued at normal rent).
- Donated materials and services (printing, catering, translation, logistics).
- Volunteer trainers or mentors whose time can be reasonably priced.

Excluded:

- All actual cash inflows (already part of `cash_revenue`).
- Regular internal overhead unless formally logged as an in-kind contribution.

### 3.3. Total Revenue (`total_revenue`)

```text
total_revenue = cash_revenue + non_monetary_revenue
-------------


You are working on an MLI Operations system that uses SQLite as its primary database.

We currently have a single table for programs:

--------------------------------
CURRENT TABLE SCHEMA (SQLite)
--------------------------------

CREATE TABLE IF NOT EXISTS mli_ops_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program TEXT NOT NULL UNIQUE,
  number_of_participants REAL,
  male REAL,
  female REAL,
  trainers REAL,
  local_trainer REAL,
  expat_trainer REAL,
  duration_days REAL,
  unit_price REAL,
  total_revenue_input REAL,
  status TEXT,
  start_date TEXT,
  end_date TEXT,
  participant_fee REAL,
  non_monetary_revenue REAL,
  actual_revenue REAL,
  program_cost REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

Business feedback:
- `trainers` is redundant (it is the sum of local_trainer and expat_trainer).
- `total_revenue_input`, `non_monetary_revenue`, and `actual_revenue` are confusing.
- The business wants:
  - Clear distinction between cash revenue and in-kind (non-monetary) contributions.
  - Proper modeling of modules and trainers.
  - Ability to record end-of-program survey ratings (content & delivery).
  - KPIs around quality (course, trainer) and profitability.

--------------------------------
BUSINESS DEFINITIONS
--------------------------------

non_monetary_revenue:
- Monetary value of in-kind contributions, such as:
  - Partner-provided trainers with no cash payment.
  - Free or subsidised venues from partners.
  - Donated materials and services (printing, catering, translation).
  - Volunteer time assigned a reasonable monetary value.
- It EXCLUDES:
  - All actual cash inflows (participant payments, cash grants, contracts).
  - Normal internal overhead costs unless explicitly recorded as in-kind support.

We want the following derived concepts:
- cash_revenue: sum of all cash inflows for the program.
- non_monetary_revenue: as defined above.
- total_revenue = cash_revenue + non_monetary_revenue.
- Profit = total_revenue - program_cost.
- Profit margin = Profit / total_revenue.

--------------------------------
TARGET DATA MODEL (SQLite)
--------------------------------

Please migrate towards this set of tables:

1) Programs

CREATE TABLE IF NOT EXISTS mli_ops_programs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'planned',
  start_date TEXT,
  end_date TEXT,

  number_of_participants INTEGER,
  male_participants INTEGER,
  female_participants INTEGER,

  participant_fee REAL,
  cash_revenue REAL,
  non_monetary_revenue REAL,
  total_revenue REAL,
  program_cost REAL,

  avg_content_rating REAL,
  avg_delivery_rating REAL,
  avg_overall_rating REAL,

  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

2) Modules

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

3) Trainers

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

4) Module-Trainers (assignment)

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

5) Program Surveys

CREATE TABLE IF NOT EXISTS mli_ops_program_surveys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id INTEGER NOT NULL,
  respondent_type TEXT,
  content_rating INTEGER CHECK (content_rating BETWEEN 1 AND 5),
  delivery_rating INTEGER CHECK (delivery_rating BETWEEN 1 AND 5),
  overall_rating REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (program_id) REFERENCES mli_ops_programs(id) ON DELETE CASCADE
);

--------------------------------
TASKS FOR YOU (THE AI)
--------------------------------

1) DATABASE MIGRATION (SQLite)
   - Generate safe, incremental SQL migration(s) to:
     a) Add new columns to the existing mli_ops_programs table:
        - male_participants (int)
        - female_participants (int)
        - cash_revenue (real)
        - total_revenue (real)
        - avg_content_rating (real)
        - avg_delivery_rating (real)
        - avg_overall_rating (real)
     b) If feasible, migrate old numeric fields:
        - Map `male` -> `male_participants`
        - Map `female` -> `female_participants`
        - Map `total_revenue_input` to `cash_revenue`
        - Map `actual_revenue` to `total_revenue` (or recompute as cash_revenue + non_monetary_revenue if both available)
     c) Drop or deprecate redundant / obsolete columns:
        - trainers
        - duration_days (if now handled at module level)
        - total_revenue_input (once cash_revenue is in use)
        - actual_revenue (once total_revenue is in use)
        - local_trainer, expat_trainer (these will be derived from trainer assignments)
     d) Create the new tables for modules, trainers, module_trainers, and program_surveys exactly as defined above.

   - Ensure migrations are idempotent where possible (IF NOT EXISTS, etc.).

2) BACKEND / API CHANGES
   Our stack is <DESCRIBE YOUR STACK HERE, e.g. "Node.js + Express", "Django REST Framework", "Laravel", etc.>.
   Update the code to:
   - Reflect the new schema in the ORM / models / entities.
   - Update existing endpoints for programs to expose:
     - cash_revenue, non_monetary_revenue, total_revenue, program_cost
     - computed profitability KPIs (profit and profit margin) as read-only fields if appropriate.
     - aggregate quality metrics (avg_content_rating, avg_delivery_rating, avg_overall_rating), either from columns or computed on the fly from surveys.

   - Add CRUD endpoints for:
     a) Modules:
        - List / create / update / delete modules per program.
     b) Trainers:
        - Master data CRUD for trainers.
     c) Module–Trainers:
        - Assign/unassign trainers to modules.
        - Store trainer_fee per module.
     d) Program Surveys:
        - Create new survey responses for a program.
        - Optionally list survey responses.
        - Optionally add an endpoint that returns aggregated ratings for a program.

3) ADMIN UI / BACKOFFICE
   - Update the admin area (e.g. React Admin, Django admin, custom Vue/React, etc.) to:
     - Show the new program fields for revenue and cost.
     - Replace old `trainers`, `local_trainer`, `expat_trainer` numeric fields with:
       - A "Trainers" section per program that lists modules and the trainers assigned.
     - Add screens to manage:
       - Trainers (list, create, edit, deactivate).
       - Modules per program (list, create, edit, delete).
       - Trainer assignment to modules, including role and trainer_fee.
       - Program survey entries and aggregated ratings.

   - Add a basic dashboard or report view that shows for each program:
     - Program name / status / dates.
     - number_of_participants, male_participants, female_participants.
     - cash_revenue, non_monetary_revenue, total_revenue.
     - program_cost, profit, profit margin.
     - avg_content_rating, avg_delivery_rating, avg_overall_rating.

4) DATA SAFETY
   - Do not drop or rename any columns without first:
     - Backing up data.
     - Providing migration scripts that copy old data into new fields where possible.
   - Where mapping is ambiguous (e.g. old fields not consistently populated), keep legacy fields but mark them as deprecated in the code and comments.

5) OUTPUT FORMAT
   - Provide:
     - SQL migration script(s) for SQLite.
     - Updated model/entity definitions.
     - Updated or new API route definitions (with request/response shapes).
     - Notes on admin UI forms and components that must be changed.
