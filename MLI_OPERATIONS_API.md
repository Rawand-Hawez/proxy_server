# MLI Operations API Reference

**Version:** 2.0
**Last Updated:** 2025-11-17
**Base URL:** `https://proxy.krdholding.dev/api/mli-ops`

---

## Table of Contents

1. [Overview](#overview)
2. [Data Model](#data-model)
3. [API Endpoints](#api-endpoints)
   - [Programs](#programs-api)
   - [Trainers](#trainers-api)
   - [Modules](#modules-api)
   - [Module-Trainer Assignments](#module-trainer-assignments-api)
   - [Program Surveys](#program-surveys-api)
4. [Request/Response Examples](#request-response-examples)
5. [Calculated Fields](#calculated-fields)

---

## Overview

The MLI Operations API provides endpoints for managing training programs, including:

- **Programs** - Core training programs with participants, revenue, and costs
- **Trainers** - Master data for local and expat trainers
- **Modules** - Program modules/components
- **Module-Trainer Assignments** - Linking trainers to specific modules
- **Program Surveys** - Quality feedback and ratings

### Key Business Concepts

**Revenue Types:**
- `cash_revenue`: Actual cash received (participant fees, contracts, grants)
- `non_monetary_revenue`: Value of in-kind contributions (free venues, donated services)
- `total_revenue`: `cash_revenue + non_monetary_revenue`

**Profitability:**
- `profit`: `total_revenue - program_cost`
- `profit_margin`: `profit / total_revenue`

**Quality Metrics:**
- `avg_content_rating`: Average rating of program content (1-5)
- `avg_delivery_rating`: Average rating of delivery quality (1-5)
- `avg_overall_rating`: Overall program rating

---

## Data Model

### 1. Programs (`mli_ops_programs`)

```typescript
interface Program {
  id: number;
  program: string;                    // Unique program name
  status: 'planned' | 'completed';
  start_date: string;                 // ISO date: "2025-01-15"
  end_date: string;                   // ISO date: "2025-01-20"

  // Participants
  number_of_participants: number;     // Total participants
  male_participants: number;
  female_participants: number;

  // Revenue & Cost
  participant_fee: number;            // Fee per participant
  cash_revenue: number;               // Actual cash received
  non_monetary_revenue: number;       // Value of in-kind contributions
  total_revenue: number;              // cash_revenue + non_monetary_revenue
  program_cost: number;               // Total program cost

  // Quality Metrics (from surveys)
  avg_content_rating: number;         // 1-5
  avg_delivery_rating: number;        // 1-5
  avg_overall_rating: number;

  notes: string;
  created_at: string;                 // ISO datetime
  updated_at: string;                 // ISO datetime
}
```

### 2. Trainers (`mli_ops_trainers`)

```typescript
interface Trainer {
  id: number;
  full_name: string;
  trainer_type: 'local' | 'expat';
  email: string;
  phone: string;
  active: number;                     // 1 = active, 0 = inactive
  created_at: string;
  updated_at: string;
}
```

### 3. Modules (`mli_ops_program_modules`)

```typescript
interface Module {
  id: number;
  program_id: number;
  name: string;                       // e.g., "Module 1: Leadership"
  description: string;
  duration_days: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}
```

### 4. Module-Trainer Assignments (`mli_ops_module_trainers`)

```typescript
interface ModuleTrainerAssignment {
  id: number;
  module_id: number;
  trainer_id: number;
  role: string;                       // e.g., "Lead Trainer", "Assistant"
  trainer_fee: number;                // Fee paid to trainer for this module
  created_at: string;
  updated_at: string;
}
```

### 5. Program Surveys (`mli_ops_program_surveys`)

```typescript
interface ProgramSurvey {
  id: number;
  program_id: number;
  respondent_type: string;            // e.g., "participant", "sponsor"
  content_rating: number;             // 1-5
  delivery_rating: number;            // 1-5
  overall_rating: number;
  comments: string;
  created_at: string;
}
```

---

## API Endpoints

### Programs API

#### List All Programs
```http
GET /api/mli-ops/programs
```

**Response:**
```json
[
  {
    "id": 1,
    "program": "Leadership Training Q1 2025",
    "status": "completed",
    "start_date": "2025-01-15",
    "end_date": "2025-01-20",
    "number_of_participants": 25,
    "male_participants": 15,
    "female_participants": 10,
    "participant_fee": 2000,
    "cash_revenue": 50000,
    "non_monetary_revenue": 10000,
    "total_revenue": 60000,
    "program_cost": 30000,
    "avg_content_rating": 4.5,
    "avg_delivery_rating": 4.3,
    "avg_overall_rating": 4.4,
    "notes": "Highly successful program",
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-21T15:30:00Z"
  }
]
```

#### Create Program
```http
POST /api/mli-ops/programs
Content-Type: application/json
```

**Request Body:**
```json
{
  "program": "Leadership Training Q1 2025",
  "status": "planned",
  "start_date": "2025-01-15",
  "end_date": "2025-01-20",
  "number_of_participants": 25,
  "male_participants": 15,
  "female_participants": 10,
  "participant_fee": 2000,
  "cash_revenue": 50000,
  "non_monetary_revenue": 10000,
  "program_cost": 30000,
  "notes": "New training program"
}
```

**Response:**
```json
{
  "success": true,
  "id": 1,
  "message": "Program created successfully"
}
```

#### Update Program
```http
PUT /api/mli-ops/programs/:id
Content-Type: application/json
```

**Request Body:** (same as Create, include `id`)
```json
{
  "id": 1,
  "program": "Leadership Training Q1 2025",
  "status": "completed",
  "number_of_participants": 30,
  "cash_revenue": 60000
}
```

#### Delete Program
```http
DELETE /api/mli-ops/programs/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Program deleted successfully"
}
```

---

### Trainers API

#### List All Trainers
```http
GET /api/mli-ops/trainers
GET /api/mli-ops/trainers?includeInactive=true
```

**Response:**
```json
[
  {
    "id": 1,
    "full_name": "Ahmed Hassan",
    "trainer_type": "local",
    "email": "ahmed@example.com",
    "phone": "+20-123-456-7890",
    "active": 1,
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2025-01-01T10:00:00Z"
  },
  {
    "id": 2,
    "full_name": "John Smith",
    "trainer_type": "expat",
    "email": "john@example.com",
    "phone": "+1-555-123-4567",
    "active": 1,
    "created_at": "2025-01-01T11:00:00Z",
    "updated_at": "2025-01-01T11:00:00Z"
  }
]
```

#### Get Single Trainer
```http
GET /api/mli-ops/trainers/:id
```

#### Create Trainer
```http
POST /api/mli-ops/trainers
Content-Type: application/json
```

**Request Body:**
```json
{
  "full_name": "Ahmed Hassan",
  "trainer_type": "local",
  "email": "ahmed@example.com",
  "phone": "+20-123-456-7890",
  "active": 1
}
```

**Note:** `trainer_type` must be either `"local"` or `"expat"`

#### Update Trainer
```http
PUT /api/mli-ops/trainers/:id
Content-Type: application/json
```

#### Delete Trainer
```http
DELETE /api/mli-ops/trainers/:id
```

---

### Modules API

#### List Modules for a Program
```http
GET /api/mli-ops/programs/:programId/modules
```

**Response:**
```json
[
  {
    "id": 1,
    "program_id": 1,
    "name": "Module 1: Leadership",
    "description": "Leadership and management skills",
    "duration_days": 3,
    "unit_price": 5000,
    "created_at": "2025-01-10T10:00:00Z",
    "updated_at": "2025-01-10T10:00:00Z"
  },
  {
    "id": 2,
    "program_id": 1,
    "name": "Module 2: Communication",
    "description": "Effective communication techniques",
    "duration_days": 2,
    "unit_price": 3000,
    "created_at": "2025-01-10T10:05:00Z",
    "updated_at": "2025-01-10T10:05:00Z"
  }
]
```

#### Get Single Module
```http
GET /api/mli-ops/modules/:id
```

#### Create Module
```http
POST /api/mli-ops/programs/:programId/modules
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Module 1: Leadership",
  "description": "Leadership and management skills",
  "duration_days": 3,
  "unit_price": 5000
}
```

#### Update Module
```http
PUT /api/mli-ops/modules/:id
Content-Type: application/json
```

#### Delete Module
```http
DELETE /api/mli-ops/modules/:id
```

---

### Module-Trainer Assignments API

#### Get Trainers for a Module
```http
GET /api/mli-ops/modules/:moduleId/trainers
```

**Response:**
```json
[
  {
    "id": 1,
    "module_id": 1,
    "trainer_id": 1,
    "role": "Lead Trainer",
    "trainer_fee": 2000,
    "full_name": "Ahmed Hassan",
    "trainer_type": "local",
    "email": "ahmed@example.com",
    "phone": "+20-123-456-7890",
    "created_at": "2025-01-10T12:00:00Z",
    "updated_at": "2025-01-10T12:00:00Z"
  }
]
```

#### Get Modules for a Trainer
```http
GET /api/mli-ops/trainers/:trainerId/modules
```

**Response:**
```json
[
  {
    "id": 1,
    "module_id": 1,
    "trainer_id": 1,
    "role": "Lead Trainer",
    "trainer_fee": 2000,
    "module_name": "Module 1: Leadership",
    "program_id": 1,
    "program_name": "Leadership Training Q1 2025",
    "created_at": "2025-01-10T12:00:00Z",
    "updated_at": "2025-01-10T12:00:00Z"
  }
]
```

#### Assign Trainer to Module
```http
POST /api/mli-ops/modules/:moduleId/trainers
Content-Type: application/json
```

**Request Body:**
```json
{
  "trainer_id": 1,
  "role": "Lead Trainer",
  "trainer_fee": 2000
}
```

#### Update Assignment
```http
PUT /api/mli-ops/module-trainers/:id
Content-Type: application/json
```

**Request Body:**
```json
{
  "role": "Lead Trainer",
  "trainer_fee": 2500
}
```

#### Remove Trainer from Module
```http
DELETE /api/mli-ops/module-trainers/:id
```

---

### Program Surveys API

#### List Surveys for a Program
```http
GET /api/mli-ops/programs/:programId/surveys
```

**Response:**
```json
[
  {
    "id": 1,
    "program_id": 1,
    "respondent_type": "participant",
    "content_rating": 5,
    "delivery_rating": 4,
    "overall_rating": 4.5,
    "comments": "Excellent program!",
    "created_at": "2025-01-21T10:00:00Z"
  },
  {
    "id": 2,
    "program_id": 1,
    "respondent_type": "participant",
    "content_rating": 4,
    "delivery_rating": 5,
    "overall_rating": 4.5,
    "comments": "Great delivery!",
    "created_at": "2025-01-21T11:00:00Z"
  }
]
```

#### Get Survey Aggregates
```http
GET /api/mli-ops/programs/:programId/surveys/aggregates
```

**Response:**
```json
{
  "totalResponses": 2,
  "avgContentRating": 4.5,
  "avgDeliveryRating": 4.5,
  "avgOverallRating": 4.5
}
```

#### Submit Survey
```http
POST /api/mli-ops/programs/:programId/surveys
Content-Type: application/json
```

**Request Body:**
```json
{
  "respondent_type": "participant",
  "content_rating": 5,
  "delivery_rating": 4,
  "overall_rating": 4.5,
  "comments": "Excellent program!"
}
```

**Note:** Ratings must be between 1 and 5

#### Update Survey
```http
PUT /api/mli-ops/surveys/:id
Content-Type: application/json
```

#### Delete Survey
```http
DELETE /api/mli-ops/surveys/:id
```

---

## Request/Response Examples

### Complete Program Creation Workflow

#### 1. Create a Program
```http
POST /api/mli-ops/programs
Content-Type: application/json

{
  "program": "Advanced Leadership 2025",
  "status": "planned",
  "start_date": "2025-03-01",
  "end_date": "2025-03-15",
  "number_of_participants": 20,
  "male_participants": 12,
  "female_participants": 8,
  "participant_fee": 3000,
  "cash_revenue": 60000,
  "non_monetary_revenue": 15000,
  "program_cost": 40000
}
```

**Response:**
```json
{
  "success": true,
  "id": 5,
  "message": "Program created successfully"
}
```

#### 2. Create Modules for the Program
```http
POST /api/mli-ops/programs/5/modules
Content-Type: application/json

{
  "name": "Module 1: Strategic Thinking",
  "description": "Developing strategic thinking skills",
  "duration_days": 5,
  "unit_price": 8000
}
```

```http
POST /api/mli-ops/programs/5/modules
Content-Type: application/json

{
  "name": "Module 2: Team Building",
  "description": "Building high-performance teams",
  "duration_days": 3,
  "unit_price": 5000
}
```

#### 3. Assign Trainers to Modules
```http
POST /api/mli-ops/modules/1/trainers
Content-Type: application/json

{
  "trainer_id": 1,
  "role": "Lead Trainer",
  "trainer_fee": 3000
}
```

#### 4. Submit Survey After Program Completion
```http
POST /api/mli-ops/programs/5/surveys
Content-Type: application/json

{
  "respondent_type": "participant",
  "content_rating": 5,
  "delivery_rating": 5,
  "overall_rating": 5,
  "comments": "Outstanding program! Highly recommend."
}
```

---

## Calculated Fields

The following fields can be calculated from other fields:

### Program Level

**Total Revenue:**
```javascript
total_revenue = cash_revenue + non_monetary_revenue
```

**Profit:**
```javascript
profit = total_revenue - program_cost
```

**Profit Margin:**
```javascript
profit_margin = (profit / total_revenue) * 100  // as percentage
```

**Number of Participants** (if not provided):
```javascript
number_of_participants = male_participants + female_participants
```

### Quality Metrics

The `avg_content_rating`, `avg_delivery_rating`, and `avg_overall_rating` in the programs table are automatically calculated from the program surveys. You can:

1. Submit individual surveys via `POST /api/mli-ops/programs/:id/surveys`
2. The system will automatically update the program's average ratings

Alternatively, you can manually set these values when creating/updating a program.

---

## Field Mappings (Backward Compatibility)

If you're migrating from the old schema, the following field mappings apply:

| Old Field Name        | New Field Name         | Notes                                    |
|-----------------------|------------------------|------------------------------------------|
| `male`                | `male_participants`    | Integer instead of REAL                  |
| `female`              | `female_participants`  | Integer instead of REAL                  |
| `total_revenue_input` | `cash_revenue`         | Renamed for clarity                      |
| `actual_revenue`      | `total_revenue`        | Renamed for clarity                      |
| `trainers`            | _(removed)_            | Now tracked via module-trainer relations |
| `local_trainer`       | _(removed)_            | Now tracked via module-trainer relations |
| `expat_trainer`       | _(removed)_            | Now tracked via module-trainer relations |
| `duration_days`       | _(removed from program)_ | Now at module level                    |
| `unit_price`          | _(removed from program)_ | Now at module level                    |

The API will accept old field names for backward compatibility, but they will be mapped to the new field names internally.

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error

---

## Notes for Front-End Development

1. **Date Format**: All dates are in ISO 8601 format (`YYYY-MM-DD` for dates, full ISO string for datetimes)

2. **Revenue Calculation**: When creating/updating programs:
   - If you don't provide `total_revenue`, it will be calculated as `cash_revenue + non_monetary_revenue`
   - If you don't provide `cash_revenue`, it can be calculated as `number_of_participants * participant_fee`

3. **Participant Counts**:
   - If you provide `male_participants` and `female_participants`, `number_of_participants` will be calculated automatically
   - You can also provide `number_of_participants` directly

4. **Survey Ratings**:
   - All ratings must be between 1 and 5
   - Submit individual survey responses, and the system will calculate averages

5. **Cascade Deletes**:
   - Deleting a program will delete all its modules, and all module-trainer assignments
   - Deleting a module will delete all its trainer assignments
   - You cannot delete a trainer that is assigned to modules (remove assignments first)

6. **Active/Inactive Trainers**:
   - Use `active: 1` for active trainers, `active: 0` for inactive
   - By default, `GET /api/mli-ops/trainers` returns only active trainers
   - Use `?includeInactive=true` to get all trainers

---

**For questions or issues, contact the backend development team.**
