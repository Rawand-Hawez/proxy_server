# Climate Projects API Documentation

A complete database-backed API for managing climate and environmental sustainability projects.

## Overview

This API provides full CRUD (Create, Read, Update, Delete) operations for climate projects, replacing the previous hardcoded data approach with a robust SQLite database backend.

## Features

- ✅ **Database Storage**: SQLite-backed persistent storage
- ✅ **RESTful API**: Complete CRUD operations
- ✅ **Admin Interface**: Beautiful web UI for managing projects
- ✅ **Authentication**: Token-based API security
- ✅ **Statistics**: Real-time project metrics and KPIs
- ✅ **Migration**: Import script for existing data

## Quick Start

### 1. Import Existing Climate Data

```bash
node scripts/import-climate-data.js
```

This will import all 9 climate projects into the database.

### 2. Access the Admin Interface

Open your browser and navigate to:
```
http://localhost:3000/admin/climate
```

### 3. Use the API

All API endpoints require authentication with your `ADMIN_TOKEN` from the `.env` file.

```bash
# Example: Get all projects
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:3000/api/climate/projects
```

## API Endpoints

### Get All Projects

**GET** `/api/climate/projects`

Returns a list of all climate projects.

**Query Parameters:**
- `limit` (optional): Maximum number of results (default: 1000)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "success": true,
  "count": 9,
  "data": [
    {
      "id": 1,
      "project": "Recycle Bins",
      "amount": 500,
      "unit": "Bins",
      "duration": "July - Aug",
      "status": "Done",
      "location": "Hawler & Duhok",
      "partner": "Ministry of Municipality and Tourism",
      "directBeneficiary": 15,
      "indirectBeneficiary": 25000,
      "environmentalOutcome": "8 ton/monthly plastics saved...",
      "brief": "Installing 350 in Hawler and 150 in Duhok...",
      "createdAt": "2025-11-16 07:07:52",
      "updatedAt": "2025-11-16 07:07:52"
    }
  ]
}
```

### Get Project by ID

**GET** `/api/climate/projects/:id`

Returns a single project by its ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "project": "Recycle Bins",
    ...
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Project not found"
}
```

### Get Statistics

**GET** `/api/climate/stats`

Returns aggregated statistics about all projects.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalProjects": 9,
    "directBeneficiaries": 3427,
    "indirectBeneficiaries": 106300,
    "projectsByStatus": {
      "done": 8,
      "inProgress": 1
    }
  }
}
```

### Create Project

**POST** `/api/climate/projects`

Creates a new climate project.

**Request Body:**
```json
{
  "project": "New Climate Initiative",
  "amount": 1000,
  "unit": "Trees",
  "duration": "Jan - Mar",
  "status": "In Progress",
  "location": "Hawler",
  "partner": "Environmental Agency",
  "directBeneficiary": 500,
  "indirectBeneficiary": 5000,
  "environmentalOutcome": "Reduce CO2 by 10 tons per year",
  "brief": "A tree planting initiative across the city"
}
```

**Required Fields:**
- `project` (string): Project name
- `amount` (number): Amount/quantity
- `unit` (string): Unit of measurement
- `duration` (string): Time period
- `status` (string): Status (e.g., "Done", "In Progress", "Planned")
- `location` (string): Project location
- `partner` (string): Partner organization

**Optional Fields:**
- `directBeneficiary` (number): Direct beneficiaries count
- `indirectBeneficiary` (number): Indirect beneficiaries count
- `environmentalOutcome` (string): Environmental impact description
- `brief` (string): Project description

**Response (201):**
```json
{
  "success": true,
  "message": "Climate project created successfully",
  "id": 10
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Missing required fields: project, amount, unit"
}
```

### Update Project

**PUT** `/api/climate/projects/:id`

Updates an existing project.

**Request Body:** Same as Create Project

**Response (200):**
```json
{
  "success": true,
  "message": "Climate project updated successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Project not found"
}
```

### Delete Project

**DELETE** `/api/climate/projects/:id`

Deletes a project by ID.

**Response (200):**
```json
{
  "success": true,
  "message": "Climate project deleted successfully"
}
```

**Error Response (404):**
```json
{
  "success": false,
  "error": "Project not found"
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
curl -H "Authorization: Bearer tT5FK9oEP8zPX3CeDA38iZ8bL6gKw8JB" \
  http://localhost:3000/api/climate/projects
```

### Example with JavaScript:

```javascript
const response = await fetch('http://localhost:3000/api/climate/projects', {
  headers: {
    'Authorization': 'Bearer YOUR_ADMIN_TOKEN',
    'Content-Type': 'application/json'
  }
});
const data = await response.json();
```

## Admin Web Interface

The admin interface provides a beautiful, user-friendly way to manage climate projects without writing code.

**URL:** `http://localhost:3000/admin/climate`

### Features:

- 📊 **Real-time Statistics Dashboard**: View total projects, beneficiaries, and completion status
- ➕ **Add Projects**: Easy form-based project creation
- ✏️ **Edit Projects**: Update existing project details
- 🗑️ **Delete Projects**: Remove projects with confirmation
- 🔄 **Live Updates**: Automatic data refresh
- 📱 **Responsive Design**: Works on all devices

## Database Schema

**Table:** `climate_projects`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `project` | TEXT | Project name (required) |
| `amount` | INTEGER | Amount/quantity (required) |
| `unit` | TEXT | Unit of measurement (required) |
| `duration` | TEXT | Time period (required) |
| `status` | TEXT | Project status (required) |
| `location` | TEXT | Project location (required) |
| `partner` | TEXT | Partner organization (required) |
| `direct_beneficiary` | INTEGER | Direct beneficiaries count |
| `indirect_beneficiary` | INTEGER | Indirect beneficiaries count |
| `environmental_outcome` | TEXT | Environmental impact |
| `brief` | TEXT | Project description |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update timestamp |

## Migration from Hardcoded Data

### Option 1: Use the Import Script (Recommended)

```bash
node scripts/import-climate-data.js
```

This will:
- ✅ Connect to the database
- ✅ Import all 9 projects from `docs/data/climate/climate.js`
- ✅ Display import summary and statistics
- ✅ Verify data integrity

### Option 2: Manual Import via API

You can also manually create projects using the POST endpoint:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project": "Recycle Bins",
    "amount": 500,
    "unit": "Bins",
    ...
  }' \
  http://localhost:3000/api/climate/projects
```

## Integration with Dashboard

### Update your dashboard's JavaScript:

Replace the hardcoded `CLIMATE_DATA` with API calls:

```javascript
// Old approach (hardcoded)
const CLIMATE_DATA = { projects: [...] };

// New approach (API)
async function loadClimateData() {
  const response = await fetch('http://localhost:3000/api/climate/projects', {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });

  const result = await response.json();

  if (result.success) {
    return result.data; // Array of projects
  }
}

// Get statistics
async function loadClimateStats() {
  const response = await fetch('http://localhost:3000/api/climate/stats', {
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN'
    }
  });

  const result = await response.json();

  if (result.success) {
    return result.data;
  }
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
- `400` - Bad Request (validation error)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found (project doesn't exist)
- `500` - Internal Server Error
- `503` - Service Unavailable (database not initialized)

## Best Practices

### 1. Always Check Success Flag

```javascript
const result = await response.json();
if (result.success) {
  // Handle success
  console.log(result.data);
} else {
  // Handle error
  console.error(result.error);
}
```

### 2. Use Pagination for Large Datasets

```javascript
// Get first 50 projects
const response = await fetch('/api/climate/projects?limit=50&offset=0');

// Get next 50 projects
const response = await fetch('/api/climate/projects?limit=50&offset=50');
```

### 3. Validate Before Sending

Ensure all required fields are present before making POST/PUT requests:

```javascript
function validateProject(project) {
  const required = ['project', 'amount', 'unit', 'duration', 'status', 'location', 'partner'];
  const missing = required.filter(field => !project[field]);

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}
```

### 4. Handle Network Errors

```javascript
try {
  const response = await fetch('/api/climate/projects', {
    headers: { 'Authorization': 'Bearer TOKEN' }
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  // Process data
} catch (error) {
  console.error('Failed to fetch projects:', error);
  // Show user-friendly error message
}
```

## Testing

### Test All Endpoints:

```bash
# Get stats
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/climate/stats

# Get all projects
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/climate/projects

# Get specific project
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/climate/projects/1

# Create project
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project":"Test","amount":100,...}' \
  http://localhost:3000/api/climate/projects

# Update project
curl -X PUT \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project":"Updated","amount":200,...}' \
  http://localhost:3000/api/climate/projects/10

# Delete project
curl -X DELETE \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/climate/projects/10
```

## Support

For issues or questions:

1. Check server logs: `tail -f logs/server.log` (if logging is configured)
2. Verify database connection: Check that `data/proxy_server.db` exists
3. Test authentication: Verify your `ADMIN_TOKEN` in `.env`
4. Check network: Ensure server is running on port 3000

## Future Enhancements

Possible improvements for future versions:

- [ ] Add filtering and searching capabilities
- [ ] Implement project categories/tags
- [ ] Add image upload for projects
- [ ] Export projects to CSV/Excel
- [ ] Add user roles and permissions
- [ ] Implement project versioning/history
- [ ] Add email notifications for updates
- [ ] Create public API (read-only) without authentication

## License

Part of the Dashboard Proxy Server project.
