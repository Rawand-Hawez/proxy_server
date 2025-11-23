# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Starting the Server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Testing
```bash
# Initialize database tables (if needed)
node init-database.js
```

### Docker Deployment
```bash
# Build Docker image
docker build -t proxy-server .

# Run with docker-compose
docker-compose up -d
```

## High-Level Architecture

### Service Layer Design

The application follows a **three-tier service architecture**:

1. **Main Server** ([server.js](server.js)) - Express app, routes, middleware, and request handling
2. **Service Layer** - Three core services initialized at startup:
   - **DatabaseService** ([databaseService.js](databaseService.js)) - SQLite database operations and schema management
   - **CacheService** ([cacheService.js](cacheService.js)) - Redis-first caching with SQLite fallback
   - **OdooService** ([odooService.js](odooService.js)) - XML-RPC integration with Odoo ERP (optional)

### Service Initialization Pattern

Services are initialized asynchronously in server.js with proper error handling:

```javascript
// Initialize in order: Database → Cache → Odoo
const { databaseService, cacheService } = await initializeServices();
```

**Critical**: DatabaseService must initialize first as CacheService depends on it for fallback caching.

### Cache Strategy

The system implements a **dual-cache architecture**:

- **Primary**: Redis (if configured via REDIS_HOST env var)
- **Fallback**: SQLite `api_cache` table (always available)

**Cache flow**:
1. Check Redis (if enabled)
2. On Redis miss/failure, check SQLite
3. On both miss, fetch from source API
4. Store in both Redis and SQLite (if both enabled)

This ensures the server always functions even without Redis.

### Database Schema Organization

The SQLite database contains several distinct domain schemas:

**Core Infrastructure Tables**:
- `api_cache` - API response caching
- `api_logs` - Request/response logging and performance metrics
- `app_config` - Key-value configuration storage
- `user_sessions` - Web interface session management
- `sync_logs` - Data synchronization tracking
- `custom_data` - Generic user-defined records

**Domain-Specific Tables**:
- `climate_projects` - Climate initiative tracking
- `marketing_projects`, `marketing_metrics`, `marketing_data` - Marketing analytics (time series)
- `mli_ops_programs`, `mli_ops_trainers`, `mli_ops_program_modules`, `mli_ops_module_trainers`, `mli_ops_program_surveys` - MLI operations management
- `property_rentals`, `property_rental_tenants` - Property management

**Schema Migration Pattern**:
Database schema is managed through two mechanisms:
1. Base schema in `createTables()` method in [databaseService.js](databaseService.js)
2. SQL migrations in `migrations/` directory applied via helper methods (`ensureMliOpsSchema()`, `ensurePropertyRentalSchema()`)

When adding new tables, use the `ensureXxxSchema()` pattern called from `createTables()`.

### Odoo Integration Architecture

Odoo integration uses **XML-RPC protocol** (not REST):

1. **Authentication**: Obtain UID via `authenticate()` method
2. **API Calls**: Use `execute()` or `search_read()` wrappers
3. **Data Models**: Access Odoo models (res.partner, sale.order, account.move, pos.order, etc.)

**Important**: All Odoo endpoints check for service availability before execution. If ODOO_URL is not configured, endpoints return appropriate errors.

### Data Extraction Utilities

The server includes date-range utilities (`dateUtils` in [server.js](server.js)) for:
- Monthly data extraction (`getMonthRange()`)
- Quarterly data extraction (`getQuarterRange()`)
- Current period helpers

These are used extensively in `/extract/*` endpoints to support dashboard analytics.

### API Endpoint Patterns

**Proxy Endpoints** (pass-through to external APIs):
- `/api/erbil`, `/api/duhok`, `/api/bahrka` - TopCare lab APIs
- `/erbil-avenue/:resource` - Erbil Avenue Supabase proxy

**Data Endpoints** (server-managed data):
- `/extract/*` - Date-range data extraction with caching
- `/odoo/*` - Odoo ERP integration endpoints
- `/admin/*` - Administrative interface and management
- `/climate/*`, `/marketing/*`, `/mli-ops/*` - Domain-specific CRUD operations

### Security & Middleware Stack

The server uses:
- **helmet** - HTTP security headers
- **express-rate-limit** - API rate limiting (configurable via RATE_LIMIT_WINDOW, RATE_LIMIT_MAX)
- **cors** - Cross-origin requests with configurable origins (CORS_ALLOWED_ORIGINS)
- **Token-based auth** - Simple bearer token authentication (ADMIN_TOKEN env var)

**Note**: Most API endpoints require Authorization header with bearer token.

### Admin Web Interface

The server includes an HTML-based admin interface at `/admin`:
- System status dashboard
- Cache statistics and management
- Database browser for custom data
- API logs viewer
- Configuration editor

Admin pages are served from `public/` directory:
- [public/docs.html](public/docs.html) - API documentation
- [public/climate-admin.html](public/climate-admin.html) - Climate data management
- [public/mli-ops-admin.html](public/mli-ops-admin.html) - MLI operations management

## Important Implementation Notes

### Environment Variables

The application requires a `.env` file based on [.env.example](.env.example). Critical variables:

**Required**:
- `PORT` - Server port (default: 3000)

**Optional but recommended**:
- `DATABASE_PATH` - SQLite database location (default: ./data/proxy_server.db)
- `ADMIN_TOKEN` - API authentication token (default: demo-token-12345)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis configuration
- `ODOO_URL`, `ODOO_DB`, `ODOO_USER`, `ODOO_PASSWORD` - Odoo ERP credentials

### Database Service Methods

When working with the database:

- Use `runQuery()` for INSERT/UPDATE/DELETE (returns {id, changes})
- Use `getQuery()` for single row SELECT (returns single object or undefined)
- Use `allQuery()` for multi-row SELECT (returns array)

All database methods are async and return Promises.

### Error Handling Pattern

All API endpoints follow a consistent error handling pattern:

```javascript
try {
  // Endpoint logic
  res.json({ success: true, data: result });
} catch (error) {
  console.error('Error description:', error);
  res.status(500).json({
    error: 'User-friendly message',
    details: error.message
  });
}
```

Maintain this pattern when adding new endpoints.

### Cache Key Generation

CacheService generates deterministic cache keys using:
- Endpoint path
- Query parameters (sorted)
- Hash function (MD5)

When implementing cached endpoints, use `cacheService.get()` and `cacheService.set()` with appropriate TTL values.

### Docker Deployment Considerations

The Dockerfile uses Alpine Linux and includes:
- Migration SQL files copied to `/app/migrations/`
- Public HTML admin interfaces copied to `/app/public/`
- Data directory created at `/app/data` for persistent storage

**Database Deployment**: The seeded SQLite database (`data/proxy_server.db`) is tracked in git and deployed with the application. On startup, `init-database.js` ensures all tables exist but does not import seed data (data is already in the deployed database).

When adding new migrations, add SQL files to the `migrations/` directory and apply them via the database service's schema methods.

## Common Development Patterns

### Adding a New API Endpoint

1. Add route handler in [server.js](server.js)
2. Implement authentication if needed
3. Add caching logic if appropriate
4. Follow error handling pattern
5. Add logging via `databaseService.logApiCall()`
6. Update API documentation in [public/docs.html](public/docs.html)

### Adding a New Database Table

1. Add CREATE TABLE statement to `createTables()` in [databaseService.js](databaseService.js), OR
2. Create SQL migration file in `migrations/` directory
3. Add corresponding CRUD methods to DatabaseService
4. Create migration deployment script if needed
5. Test with `node init-database.js`

### Adding a New Odoo Endpoint

1. Define new method in [odooService.js](odooService.js) using `execute()` or `search_read()`
2. Add route in [server.js](server.js) that calls the Odoo method
3. Handle Odoo authentication errors appropriately
4. Include caching for read-heavy endpoints

### Working with Migrations

New schema changes should be added as SQL files in `migrations/` directory, following the naming pattern `NNN_description.sql`. Reference existing migrations like [migrations/008_drop_and_recreate_mli_tables.sql](migrations/008_drop_and_recreate_mli_tables.sql) and [migrations/009_add_program_cost_breakdown.sql](migrations/009_add_program_cost_breakdown.sql).

Apply migrations by creating corresponding methods in [databaseService.js](databaseService.js) (e.g., `ensureXxxSchema()`) and calling them from the `createTables()` method.
