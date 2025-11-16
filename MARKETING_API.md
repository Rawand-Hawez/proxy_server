# Marketing Data API Documentation

A flexible, multi-project marketing metrics system for tracking time-series data across different marketing campaigns and platforms.

## Overview

This API provides a comprehensive solution for managing marketing metrics across multiple projects (MLI, Climate, and future projects). It supports flexible metric definitions, time-series data storage, bulk uploads, and automated KPI calculations.

## Features

- ✅ **Multi-Project Support**: Manage metrics for unlimited projects in one system
- ✅ **Dynamic Metrics**: Add custom metrics without database schema changes
- ✅ **Time-Series Data**: Store and query daily performance metrics
- ✅ **Bulk Upload**: Efficiently import large datasets via JSON
- ✅ **Auto-calculated KPIs**: Total, average, max, min computed on-the-fly
- ✅ **Grouped Data**: Organize results by metric for easy visualization
- ✅ **Smart Upsert**: Updates existing data, inserts new (no duplicates)
- ✅ **Date Filtering**: Query any date range with precision
- ✅ **Authentication**: Token-based API security

## Quick Start

### 1. Import MLI Marketing Data

```bash
node scripts/import-mli-marketing-data.js
```

This will import:
- 1 Project (MLI Marketing)
- 8 Metrics (FB Views/Visits/Viewers, IG Reach/Interactions/Views/Follows/Visits)
- 248 Data Points (October 2025 daily data)

### 2. Test the API

```bash
# Set your admin token
TOKEN="YOUR_ADMIN_TOKEN"

# Get all projects
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/marketing/projects

# Get MLI statistics
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/marketing/mli/stats?from=2025-10-01&to=2025-10-31"
```

## Database Architecture

### Tables

**marketing_projects** - Project definitions
```sql
id              INTEGER PRIMARY KEY
project_key     TEXT UNIQUE      -- e.g., 'mli', 'climate'
project_name    TEXT             -- Display name
description     TEXT
created_at      DATETIME
updated_at      DATETIME
```

**marketing_metrics** - Metric definitions per project
```sql
id              INTEGER PRIMARY KEY
project_id      INTEGER          -- FK to marketing_projects
metric_key      TEXT             -- e.g., 'fb_views'
metric_label    TEXT             -- e.g., 'Facebook Views'
category        TEXT             -- e.g., 'facebook', 'instagram'
created_at      DATETIME
UNIQUE(project_id, metric_key)
```

**marketing_data** - Daily time-series data
```sql
id              INTEGER PRIMARY KEY
project_id      INTEGER          -- FK to marketing_projects
metric_id       INTEGER          -- FK to marketing_metrics
date            DATE             -- YYYY-MM-DD
value           REAL
created_at      DATETIME
updated_at      DATETIME
UNIQUE(project_id, metric_id, date)
```

## API Endpoints

### Projects

#### Get All Projects

**GET** `/api/marketing/projects`

Returns a list of all marketing projects.

**Response:**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": 1,
      "projectKey": "mli",
      "projectName": "MLI Marketing",
      "description": "Marketing metrics for MLI project",
      "createdAt": "2025-11-16 07:15:23",
      "updatedAt": "2025-11-16 07:15:23"
    }
  ]
}
```

#### Create Project

**POST** `/api/marketing/projects`

Creates a new marketing project.

**Request Body:**
```json
{
  "projectKey": "climate",
  "projectName": "Climate Marketing",
  "description": "Marketing metrics for climate initiatives"
}
```

**Required Fields:**
- `projectKey` (string): Unique identifier (lowercase, no spaces)
- `projectName` (string): Display name

**Response (201):**
```json
{
  "success": true,
  "message": "Marketing project created successfully",
  "id": 2
}
```

#### Get Project by Key

**GET** `/api/marketing/projects/:projectKey`

Returns details for a specific project.

**Example:** `/api/marketing/projects/mli`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "projectKey": "mli",
    "projectName": "MLI Marketing",
    "description": "Marketing metrics for MLI project",
    "createdAt": "2025-11-16 07:15:23",
    "updatedAt": "2025-11-16 07:15:23"
  }
}
```

### Metrics

#### Get All Metrics for a Project

**GET** `/api/marketing/:projectKey/metrics`

Returns all metrics defined for a project.

**Example:** `/api/marketing/mli/metrics`

**Response:**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": 1,
      "projectId": 1,
      "metricKey": "fb_views",
      "metricLabel": "Facebook Views",
      "category": "facebook",
      "createdAt": "2025-11-16 07:15:23"
    },
    {
      "id": 4,
      "projectId": 1,
      "metricKey": "ig_reach",
      "metricLabel": "Instagram Reach",
      "category": "instagram",
      "createdAt": "2025-11-16 07:15:23"
    }
  ]
}
```

#### Create Metric

**POST** `/api/marketing/:projectKey/metrics`

Creates a new metric for a project.

**Example:** `/api/marketing/mli/metrics`

**Request Body:**
```json
{
  "metricKey": "twitter_impressions",
  "metricLabel": "Twitter Impressions",
  "category": "twitter"
}
```

**Required Fields:**
- `metricKey` (string): Unique identifier within project
- `metricLabel` (string): Display name

**Response (201):**
```json
{
  "success": true,
  "message": "Metric created successfully",
  "id": 9
}
```

### Time-Series Data

#### Get Data for a Project

**GET** `/api/marketing/:projectKey/data`

Returns time-series data for a date range.

**Query Parameters:**
- `from` (required): Start date (YYYY-MM-DD)
- `to` (required): End date (YYYY-MM-DD)
- `grouped` (optional): Set to `true` to group by metric

**Example (Flat):**
```
/api/marketing/mli/data?from=2025-10-01&to=2025-10-05
```

**Response (Flat):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "projectId": 1,
      "metricId": 1,
      "metricKey": "fb_views",
      "metricLabel": "Facebook Views",
      "category": "facebook",
      "date": "2025-10-01",
      "value": 55,
      "createdAt": "2025-11-16 07:15:24",
      "updatedAt": "2025-11-16 07:15:24"
    },
    {
      "id": 2,
      "projectId": 1,
      "metricId": 1,
      "metricKey": "fb_views",
      "metricLabel": "Facebook Views",
      "category": "facebook",
      "date": "2025-10-02",
      "value": 1,
      "createdAt": "2025-11-16 07:15:24",
      "updatedAt": "2025-11-16 07:15:24"
    }
  ]
}
```

**Example (Grouped):**
```
/api/marketing/mli/data?from=2025-10-01&to=2025-10-05&grouped=true
```

**Response (Grouped):**
```json
{
  "success": true,
  "data": {
    "fb_views": {
      "metricId": 1,
      "metricKey": "fb_views",
      "metricLabel": "Facebook Views",
      "category": "facebook",
      "data": [
        { "date": "2025-10-01", "value": 55 },
        { "date": "2025-10-02", "value": 1 },
        { "date": "2025-10-03", "value": 5 }
      ]
    },
    "ig_reach": {
      "metricId": 4,
      "metricKey": "ig_reach",
      "metricLabel": "Instagram Reach",
      "category": "instagram",
      "data": [
        { "date": "2025-10-01", "value": 55 },
        { "date": "2025-10-02", "value": 38 },
        { "date": "2025-10-03", "value": 37 }
      ]
    }
  }
}
```

**Use Case:** Grouped format is perfect for charting libraries like Chart.js.

#### Get Statistics

**GET** `/api/marketing/:projectKey/stats`

Returns calculated KPIs for all metrics in a date range.

**Query Parameters:**
- `from` (required): Start date (YYYY-MM-DD)
- `to` (required): End date (YYYY-MM-DD)

**Example:**
```
/api/marketing/mli/stats?from=2025-10-01&to=2025-10-31
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "metricKey": "fb_views",
      "metricLabel": "Facebook Views",
      "category": "facebook",
      "dataPoints": 31,
      "total": 39380,
      "average": 1270.32,
      "max": 21592,
      "min": 0
    },
    {
      "metricKey": "ig_reach",
      "metricLabel": "Instagram Reach",
      "category": "instagram",
      "dataPoints": 31,
      "total": 26567,
      "average": 857.0,
      "max": 10637,
      "min": 21
    }
  ]
}
```

#### Bulk Upload Data

**POST** `/api/marketing/:projectKey/data/bulk`

Efficiently upload multiple data points at once.

**Request Body:**
```json
{
  "data": [
    {
      "metricKey": "fb_views",
      "date": "2025-11-01",
      "value": 1250
    },
    {
      "metricKey": "fb_views",
      "date": "2025-11-02",
      "value": 1380
    },
    {
      "metricKey": "ig_reach",
      "date": "2025-11-01",
      "value": 2500
    }
  ]
}
```

**Required Fields per Item:**
- `metricKey` (string): Must exist in project
- `date` (string): YYYY-MM-DD format
- `value` (number): Metric value

**Response:**
```json
{
  "success": true,
  "message": "Successfully uploaded 3 data points",
  "count": 3
}
```

**Notes:**
- Uses upsert logic: updates if date exists, inserts if new
- All metrics must exist before uploading data
- Validates all data before starting import
- Stops on first error and returns which metric failed

#### Delete Data Point

**DELETE** `/api/marketing/:projectKey/data`

Deletes a specific data point.

**Query Parameters:**
- `metricKey` (required): Metric identifier
- `date` (required): Date in YYYY-MM-DD format

**Example:**
```
DELETE /api/marketing/mli/data?metricKey=fb_views&date=2025-10-01
```

**Response:**
```json
{
  "success": true,
  "message": "Data point deleted successfully"
}
```

## Authentication

All API endpoints require a Bearer token in the Authorization header:

```bash
Authorization: Bearer YOUR_ADMIN_TOKEN
```

The token is configured in your `.env` file as `ADMIN_TOKEN`.

### Example with cURL:

```bash
TOKEN="tT5FK9oEP8zPX3CeDA38iZ8bL6gKw8JB"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/marketing/mli/data?from=2025-10-01&to=2025-10-31&grouped=true"
```

### Example with JavaScript:

```javascript
const TOKEN = 'YOUR_ADMIN_TOKEN';

const response = await fetch(
  'http://localhost:3000/api/marketing/mli/data?from=2025-10-01&to=2025-10-31&grouped=true',
  {
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    }
  }
);

const result = await response.json();
if (result.success) {
  console.log(result.data);
}
```

## Common Use Cases

### 1. Dashboard Integration

Replace hardcoded data with API calls:

```javascript
// Old approach (hardcoded in mli.js)
const MLI_DATA = { fb_views: [...], ig_reach: [...] };

// New approach (API)
async function loadMLIData(fromDate, toDate) {
  const response = await fetch(
    `http://localhost:3000/api/marketing/mli/data?from=${fromDate}&to=${toDate}&grouped=true`,
    {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    }
  );

  const result = await response.json();
  return result.success ? result.data : {};
}

// Usage
const data = await loadMLIData('2025-10-01', '2025-10-31');
// data.fb_views.data = [{ date: "2025-10-01", value: 55 }, ...]
```

### 2. Display KPIs

```javascript
async function displayKPIs() {
  const response = await fetch(
    'http://localhost:3000/api/marketing/mli/stats?from=2025-10-01&to=2025-10-31',
    {
      headers: { 'Authorization': `Bearer ${TOKEN}` }
    }
  );

  const result = await response.json();

  if (result.success) {
    result.data.forEach(metric => {
      console.log(`${metric.metricLabel}: ${metric.total.toLocaleString()}`);
      console.log(`  Average: ${metric.average}`);
      console.log(`  Peak: ${metric.max}`);
    });
  }
}
```

### 3. Bulk Import from CSV

```javascript
async function importFromCSV(projectKey, csvData) {
  // Parse CSV (date, metricKey, value)
  const rows = csvData.split('\n').slice(1); // Skip header

  const data = rows.map(row => {
    const [date, metricKey, value] = row.split(',');
    return {
      metricKey: metricKey.trim(),
      date: date.trim(),
      value: parseFloat(value)
    };
  });

  const response = await fetch(
    `http://localhost:3000/api/marketing/${projectKey}/data/bulk`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ data })
    }
  );

  return await response.json();
}

// Usage
const csv = `date,metricKey,value
2025-11-01,fb_views,1250
2025-11-01,ig_reach,2500`;

await importFromCSV('mli', csv);
```

### 4. Create a New Project

```javascript
async function setupNewProject() {
  const TOKEN = 'YOUR_ADMIN_TOKEN';

  // Step 1: Create project
  const projectResponse = await fetch(
    'http://localhost:3000/api/marketing/projects',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectKey: 'climate',
        projectName: 'Climate Marketing',
        description: 'Marketing for climate initiatives'
      })
    }
  );

  // Step 2: Create metrics
  const metrics = [
    { metricKey: 'fb_impressions', metricLabel: 'Facebook Impressions', category: 'facebook' },
    { metricKey: 'tw_retweets', metricLabel: 'Twitter Retweets', category: 'twitter' }
  ];

  for (const metric of metrics) {
    await fetch(
      'http://localhost:3000/api/marketing/climate/metrics',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(metric)
      }
    );
  }

  // Step 3: Upload data
  await fetch(
    'http://localhost:3000/api/marketing/climate/data/bulk',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: [
          { metricKey: 'fb_impressions', date: '2025-11-01', value: 5000 },
          { metricKey: 'tw_retweets', date: '2025-11-01', value: 120 }
        ]
      })
    }
  );
}
```

## Error Handling

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes:

- `200` - Success
- `201` - Created (for POST requests)
- `400` - Bad Request (validation error, missing parameters)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found (project, metric, or data point doesn't exist)
- `500` - Internal Server Error
- `503` - Service Unavailable (database not initialized)

### Example Error Responses:

**Missing Parameters (400):**
```json
{
  "success": false,
  "error": "from and to date parameters are required (YYYY-MM-DD)"
}
```

**Project Not Found (404):**
```json
{
  "success": false,
  "error": "Project not found"
}
```

**Metric Not Found (400):**
```json
{
  "success": false,
  "error": "Metric not found: twitter_likes"
}
```

## Best Practices

### 1. Always Check Success Flag

```javascript
const result = await response.json();
if (result.success) {
  // Handle success
  processData(result.data);
} else {
  // Handle error
  console.error('API Error:', result.error);
  showUserMessage(result.error);
}
```

### 2. Use Grouped Data for Charts

When rendering charts, use `grouped=true` for cleaner code:

```javascript
const response = await fetch(`...?grouped=true`);
const { data } = await response.json();

// Each metric is pre-grouped
const fbViewsData = data.fb_views.data; // [{ date, value }, ...]
const igReachData = data.ig_reach.data;
```

### 3. Batch Data Uploads

Use bulk upload instead of individual requests:

```javascript
// ❌ Bad: Multiple requests
for (const dataPoint of dataPoints) {
  await fetch('/api/marketing/mli/data', {
    method: 'POST',
    body: JSON.stringify(dataPoint)
  });
}

// ✅ Good: Single bulk request
await fetch('/api/marketing/mli/data/bulk', {
  method: 'POST',
  body: JSON.stringify({ data: dataPoints })
});
```

### 4. Validate Dates

Ensure dates are in YYYY-MM-DD format:

```javascript
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

const from = formatDate(new Date('2025-10-01'));
const to = formatDate(new Date('2025-10-31'));
```

### 5. Handle Network Errors

```javascript
try {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error);
  }

  return data;
} catch (error) {
  console.error('API request failed:', error);
  // Show user-friendly message
  showNotification('Failed to load data. Please try again.');
}
```

## Import Script Reference

### MLI Import Script

Location: `scripts/import-mli-marketing-data.js`

**What it does:**
1. Creates MLI project if not exists
2. Creates 8 metrics (FB and IG metrics)
3. Imports 248 data points (31 days × 8 metrics)
4. Displays import summary and sample statistics

**Usage:**
```bash
node scripts/import-mli-marketing-data.js
```

**Output:**
```
✓ Created MLI project (ID: 1)
✓ Created 8 metrics
✓ Imported 248 data points
```

### Creating Custom Import Scripts

Template for importing other projects:

```javascript
const DatabaseService = require('../databaseService');

const PROJECT_DATA = {
  projectKey: 'your_project',
  projectName: 'Your Project Name',
  metrics: [
    { metricKey: 'metric1', metricLabel: 'Metric 1', category: 'category1' }
  ],
  data: {
    metric1: [
      { Date: '2025-11-01', Value: 100 }
    ]
  }
};

async function importData() {
  const db = new DatabaseService();
  await db.initialize();

  // Create project
  const projectId = await db.createMarketingProject({
    projectKey: PROJECT_DATA.projectKey,
    projectName: PROJECT_DATA.projectName
  });

  // Create metrics and get IDs
  const metricIds = {};
  for (const metric of PROJECT_DATA.metrics) {
    const id = await db.createMarketingMetric({
      projectId,
      ...metric
    });
    metricIds[metric.metricKey] = id;
  }

  // Import data
  for (const [metricKey, dataPoints] of Object.entries(PROJECT_DATA.data)) {
    const data = dataPoints.map(dp => ({
      projectId,
      metricId: metricIds[metricKey],
      date: dp.Date,
      value: dp.Value
    }));

    await db.bulkUpsertMarketingData(data);
  }

  await db.close();
}

importData();
```

## Testing

### Quick Test Commands

```bash
# Set your token
TOKEN="YOUR_ADMIN_TOKEN"
BASE_URL="http://localhost:3000"

# Test 1: Get all projects
curl -H "Authorization: Bearer $TOKEN" \
  $BASE_URL/api/marketing/projects

# Test 2: Get MLI metrics
curl -H "Authorization: Bearer $TOKEN" \
  $BASE_URL/api/marketing/mli/metrics

# Test 3: Get October data
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/marketing/mli/data?from=2025-10-01&to=2025-10-31&grouped=true"

# Test 4: Get statistics
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/marketing/mli/stats?from=2025-10-01&to=2025-10-31"

# Test 5: Create new metric
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"metricKey":"test_metric","metricLabel":"Test Metric","category":"test"}' \
  $BASE_URL/api/marketing/mli/metrics

# Test 6: Upload data
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":[{"metricKey":"test_metric","date":"2025-11-01","value":123}]}' \
  $BASE_URL/api/marketing/mli/data/bulk

# Test 7: Delete data
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/marketing/mli/data?metricKey=test_metric&date=2025-11-01"
```

## Comparison: Marketing vs Climate API

| Feature | Marketing API | Climate API |
|---------|--------------|-------------|
| **Purpose** | Time-series metrics data | Project-based data |
| **Multi-project** | ✅ Yes (MLI, Climate, etc.) | ❌ Single dataset |
| **Dynamic Schema** | ✅ Add metrics on-the-fly | ❌ Fixed fields |
| **Data Structure** | Time-series (date + value) | Single records |
| **Bulk Import** | ✅ Via `/data/bulk` | ❌ One at a time |
| **Date Filtering** | ✅ from/to parameters | ❌ N/A |
| **Calculated Stats** | ✅ Auto KPIs | ✅ Manual calculation |
| **Use Case** | Daily metrics tracking | Project management |

## Future Enhancements

Potential improvements for future versions:

- [ ] Admin web interface for data management
- [ ] CSV/Excel file upload UI
- [ ] Data export (CSV, Excel, JSON)
- [ ] Metric formulas (calculated metrics)
- [ ] Data aggregation (weekly, monthly views)
- [ ] Trend analysis and forecasting
- [ ] Anomaly detection
- [ ] Comparison views (YoY, MoM)
- [ ] Automated reports
- [ ] Webhook notifications for data updates
- [ ] Public read-only API (no auth required)
- [ ] Rate limiting per project
- [ ] Data retention policies
- [ ] Audit logs for data changes

## Support

For issues or questions:

1. Check API response error messages
2. Verify authentication token in `.env`
3. Ensure database is initialized
4. Check server logs for detailed errors
5. Validate date formats (YYYY-MM-DD)
6. Confirm metrics exist before uploading data

## Migration Guide

### From Hardcoded to API

**Step 1:** Run import script
```bash
node scripts/import-mli-marketing-data.js
```

**Step 2:** Update dashboard code
```javascript
// Before
const MLI_DATA = require('./mli.js');

// After
const MLI_DATA = await fetch(
  'http://localhost:3000/api/marketing/mli/data?from=2025-10-01&to=2025-10-31&grouped=true',
  { headers: { 'Authorization': 'Bearer TOKEN' } }
).then(r => r.json()).then(r => r.data);
```

**Step 3:** Update functions
```javascript
// Before
function getMLIKPIs() {
  const data = MLI_DATA.projects;
  return { ... };
}

// After
async function getMLIKPIs(from, to) {
  const response = await fetch(
    `http://localhost:3000/api/marketing/mli/stats?from=${from}&to=${to}`,
    { headers: { 'Authorization': 'Bearer TOKEN' } }
  );
  return response.json().then(r => r.data);
}
```

## License

Part of the Dashboard Proxy Server project.
