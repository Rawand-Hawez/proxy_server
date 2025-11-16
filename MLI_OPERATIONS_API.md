# MLI Operations API Documentation

A complete CRUD API and admin interface for tracking MLI training programs, revenue, and operational metrics.

## Overview

The MLI Operations module replaces the legacy “coming soon” placeholder with a fully backed SQLite dataset, REST API, and SPA admin panel. It shares the same authentication model as the rest of the proxy server, so every request (except health checks) must include the `Authorization: Bearer <ADMIN_TOKEN>` header.

## Features

- ✅ **Database Storage** – Programs are stored in the `mli_ops_programs` table inside `data/proxy_server.db`.
- ✅ **Seed Import** – On first run, the records from `docs/data/mli_ops/programs.db` are copied into SQLite.
- ✅ **RESTful API** – List, create, update, delete, and bulk-clear operations with derived metric helpers.
- ✅ **Admin UI** – Navigate to `/admin/mli-ops` for a React-free SPA that consumes the API.
- ✅ **Derived Metrics** – API responses calculate trainer totals, computed revenue, and override flags automatically.

## Quick Start

1. **Install Dependencies & Initialize DB**
   ```bash
   npm install
   node init-database.js
   ```

2. **Run the Server**
   ```bash
   PORT=4000 npm run dev
   ```
   (Use any free port; 3000 may already be in use.)

3. **Open the Admin Panel**
   Visit `http://localhost:4000/admin/mli-ops` and authenticate via your proxy (or add the `Authorization` header through a browser plugin).

## Data Model

Each program contains the following persisted fields:

| Column | Type | Description |
| --- | --- | --- |
| `program` | TEXT (unique) | Program name (required) |
| `number_of_participants` | REAL | Total participants |
| `male`, `female` | REAL | Gender split |
| `local_trainer`, `expat_trainer` | REAL | Trainer counts per type |
| `duration_days` | REAL | Program duration in days |
| `participant_fee` | REAL | Fee per participant |
| `unit_price` | REAL | Optional legacy column for Excel imports |
| `total_revenue_input` | REAL | Manual revenue override |
| `non_monetary_revenue`, `actual_revenue` | REAL | Additional revenue sources |
| `start_date`, `end_date` | TEXT | ISO dates (YYYY-MM-DD) |
| `status` | TEXT | `planned`, `completed`, or `auto` (auto calculates based on start date & participants) |
| `notes` | TEXT | Optional notes shown in admin UI |

Computed fields returned by the API:

- `trainers` – sum of local and expat trainers
- `computed_revenue` – `participants * participant_fee` (if both exist)
- `final_revenue` – `total_revenue_input` when provided, otherwise `computed_revenue`
- `revenue_overridden` – boolean flag when manual override differs from computed revenue

## API Endpoints

Base path: `/api/mli-ops/programs`

All endpoints require the standard `Authorization` header.

### 1. List Programs

**GET** `/api/mli-ops/programs`

**Response**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1,
      "program": "Sales Course",
      "status": "completed",
      "number_of_participants": 11,
      "trainers": 1,
      "participant_fee": 286,
      "final_revenue": 3146,
      "computed_revenue": 3146,
      "revenue_overridden": false,
      "start_date": "2024-05-10",
      "end_date": "2024-05-12",
      "notes": null
    }
  ]
}
```

### 2. Create Program

**POST** `/api/mli-ops/programs`

**Body**
```json
{
  "program": "Leadership Essentials",
  "number_of_participants": 18,
  "male": 9,
  "female": 9,
  "local_trainer": 1,
  "expat_trainer": 1,
  "duration_days": 3,
  "start_date": "2025-01-15",
  "end_date": "2025-01-17",
  "participant_fee": 250,
  "non_monetary_revenue": 500,
  "actual_revenue": 0,
  "status": "auto",
  "notes": "Pilot cohort"
}
```

**Response** – returns the saved program with computed fields.

### 3. Update Program

**PUT** `/api/mli-ops/programs/:id`

Send any subset of fields; unspecified attributes retain their previous values. Attempting to update a missing ID returns `404`.

### 4. Delete Program

**DELETE** `/api/mli-ops/programs/:id`

Removes a single program.

### 5. Clear All Programs

**DELETE** `/api/mli-ops/programs`

Clears the table—primarily for reseeding/testing. Use cautiously.

## Admin Interface

- URL: `/admin/mli-ops`
- Features: stats tiles, editable table, modal form, toast notifications, and “Clear All” button.
- Built using vanilla JS to respect the project’s CSP (no inline scripts or external JS bundles besides built-in browser APIs).

## Troubleshooting

- **Unauthorized (401/403)** – Ensure `ADMIN_TOKEN` header matches the server’s environment variable.
- **Seed Data Missing** – Double-check `docs/data/mli_ops/programs.db` is committed; `init-database.js` logs a warning if the file is absent.
- **Port Conflicts** – Set `PORT` before running the server (e.g., `PORT=4000 npm run dev`).

## Related Resources

- Seed dataset & legacy UI: `docs/data/mli_ops/`
- Admin SPA: `public/mli-ops-admin.html`
- Database helpers: `databaseService.js`
- API implementation: `server.js`
