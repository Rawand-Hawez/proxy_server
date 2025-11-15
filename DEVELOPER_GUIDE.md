# Developer Guide - Dashboard Proxy Server

This guide provides technical documentation for developers working on the Dashboard Proxy Server.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [API Design Patterns](#api-design-patterns)
5. [Adding New Endpoints](#adding-new-endpoints)
6. [Odoo Integration](#odoo-integration)
7. [Date Range Utilities](#date-range-utilities)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Technology Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **HTTP Client**: Axios
- **Odoo Integration**: XML-RPC (xmlrpc package)
- **Environment Management**: dotenv
- **Container**: Docker (Alpine Linux)

### System Design
The server acts as a proxy/aggregation layer between frontend dashboards and multiple backend data sources:

```
Frontend Dashboard
       ↓
Dashboard Proxy Server (Express)
       ↓
├── TopCare APIs (Erbil, Duhok, Bahrka)
├── Erbil Avenue (Supabase)
└── Odoo ERP (XML-RPC)
```

### Key Features
- **Unified API**: Single endpoint for all data sources
- **Date Range Extraction**: Monthly, quarterly, and custom date ranges
- **CORS Enabled**: Cross-origin requests supported
- **Health Monitoring**: Health check endpoint with system status
- **Error Handling**: Consistent error responses across all endpoints

---

## Project Structure

```
proxy_server/
├── server.js              # Main Express application
├── odooService.js         # Odoo XML-RPC service layer
├── test-odoo-auth.js      # Odoo authentication test utility
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (not in git)
├── .gitignore            # Git ignore rules
├── Dockerfile            # Docker container definition
├── .dockerignore         # Docker ignore rules
├── README.md             # User-facing documentation
├── DEVELOPER_GUIDE.md    # This file
└── docs/
    └── odoo.md           # Original Python Odoo bridge documentation
```

---

## Core Components

### 1. Main Server (`server.js`)

The main Express application handles:
- Route definitions
- CORS configuration
- Error handling middleware
- Date utility functions
- Proxy logic for external APIs

#### Key Sections

**CORS Configuration**
```javascript
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**Date Utilities**
```javascript
const dateUtils = {
  getMonthRange: (year, month) => { /* ... */ },
  getQuarterRange: (year, quarter) => { /* ... */ },
  getCurrentMonthRange: () => { /* ... */ },
  getCurrentQuarterRange: () => { /* ... */ }
};
```

**Health Check**
```javascript
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    odoo_configured: !!process.env.ODOO_URL,
    available_endpoints: { /* ... */ }
  });
});
```

### 2. Odoo Service (`odooService.js`)

XML-RPC service layer for Odoo ERP integration.

#### Class Structure

```javascript
class OdooService {
  constructor(url, db, username, password)

  // Core methods
  async authenticate()
  async execute(model, method, args, kwargs)
  async searchRead(model, domain, fields, limit, offset)

  // Business methods
  async getPartners(limit)
  async getSaleOrders(limit, startDate, endDate)
  async getInvoices(limit, startDate, endDate)
  async getPosOrders(limit, startDate, endDate)
  async getPosPayments(limit, startDate, endDate)
  async getPosSummary(startDate, endDate)
  async getStockLevels(limit)
  async getStockMovements(limit)
  async getStockPickings(limit)
  async getInventorySummary(groupBy, limit)
  async getDashboard()
  async getModel(modelName, domain, fields, limit)
}
```

#### Authentication Flow

1. Client created with `/xmlrpc/2/common` endpoint
2. `authenticate()` method called with credentials
3. Returns `uid` (user ID) on success
4. `uid` used for subsequent API calls via `/xmlrpc/2/object` endpoint

---

## API Design Patterns

### 1. Endpoint Naming Convention

| Pattern | Example | Purpose |
|---------|---------|---------|
| `/api/<location>` | `/api/erbil` | Direct API proxy |
| `/extract/<period>` | `/extract/monthly` | Date-based extraction |
| `/odoo/<resource>` | `/odoo/pos_orders` | Odoo resources |
| `/odoo/inventory/<type>` | `/odoo/inventory/stock_levels` | Nested Odoo resources |
| `/odoo/model/<model>` | `/odoo/model/res.partner` | Generic Odoo model access |

### 2. Standard Response Format

All endpoints return consistent JSON structure:

**Success Response**
```json
{
  "success": true,
  "count": 10,
  "data": [ /* array of records */ ]
}
```

**Error Response**
```json
{
  "success": false,
  "error": "Error message here"
}
```

**Date Range Response** (for extraction endpoints)
```json
{
  "period": "monthly",
  "dateRange": {
    "start": "2025-11-01T00:00:00.000Z",
    "end": "2025-11-30T23:59:59.999Z",
    "startFormatted": "2025-11-01",
    "endFormatted": "2025-11-30"
  },
  "location": "erbil",
  "data": [ /* ... */ ]
}
```

### 3. Query Parameter Standards

| Parameter | Type | Format | Purpose |
|-----------|------|--------|---------|
| `limit` | Number | 1-5000 | Limit records returned |
| `year` | Number | YYYY | Year for date filtering |
| `month` | Number | 1-12 | Month for date filtering |
| `quarter` | Number | 1-4 | Quarter for date filtering |
| `start_date` | String | YYYY-MM-DD | Custom range start |
| `end_date` | String | YYYY-MM-DD | Custom range end |
| `location` | String | erbil/duhok/bahrka/erbil-avenue | Data source |
| `resource` | String | dashboard/history/expected-rent | Erbil Avenue resource |

---

## Adding New Endpoints

### Example: Adding a New TopCare Location

1. **Add API URL to configuration**
```javascript
const TOPCARE_APIS = {
  erbil: 'https://topcare.krd/api.php?resource=mri-erbil',
  duhok: 'https://topcare.krd/api.php?resource=mri-duhok',
  bahrka: 'https://topcare.krd/api.php?resource=mri-bahrka',
  // Add new location
  sulaymaniyah: 'https://topcare.krd/api.php?resource=mri-sulaymaniyah'
};
```

2. **Add route handler**
```javascript
app.get('/api/sulaymaniyah', async (req, res) => {
  try {
    const response = await axios.get(TOPCARE_APIS.sulaymaniyah, {
      headers: { 'Content-Type': 'application/json' }
    });
    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    console.error('Error fetching Sulaymaniyah data:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

3. **Update health check**
```javascript
app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    available_endpoints: {
      topcare: {
        // ... existing endpoints
        sulaymaniyah: 'http://localhost:3000/api/sulaymaniyah'
      }
    }
  });
});
```

4. **Update README.md** with new endpoint documentation

### Example: Adding a New Odoo Endpoint

1. **Add method to `odooService.js`**
```javascript
async getProducts(limit = 100, startDate = null, endDate = null) {
  const domain = [];

  if (startDate && endDate) {
    domain.push(['create_date', '>=', startDate]);
    domain.push(['create_date', '<=', endDate]);
  }

  return await this.searchRead(
    'product.product',
    domain,
    ['name', 'list_price', 'qty_available', 'categ_id'],
    limit
  );
}
```

2. **Add route handler in `server.js`**
```javascript
app.get('/odoo/products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const dateRange = getDateRange(req.query);

    const products = await odooService.getProducts(
      limit,
      dateRange.startDate,
      dateRange.endDate
    );

    res.json({
      success: true,
      count: products.length,
      data: products,
      ...(dateRange.startDate && {
        date_range: {
          start: dateRange.startDate,
          end: dateRange.endDate
        }
      })
    });
  } catch (error) {
    console.error('Error fetching Odoo products:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

3. **Update README.md** with endpoint documentation

---

## Odoo Integration

### XML-RPC Protocol

Odoo uses XML-RPC for external API access. Two main endpoints:

1. **Common Endpoint** (`/xmlrpc/2/common`): Authentication
2. **Object Endpoint** (`/xmlrpc/2/object`): CRUD operations

### Authentication

```javascript
// Create client
const client = xmlrpc.createSecureClient({
  host: 'chronoclash.odoo.com',
  port: 443,
  path: '/xmlrpc/2/common'
});

// Authenticate
client.methodCall('authenticate', [
  'database_name',
  'username',
  'password',
  {}
], (error, uid) => {
  // uid is user ID on success
});
```

### Executing Methods

```javascript
// Create object client
const objectClient = xmlrpc.createSecureClient({
  host: 'chronoclash.odoo.com',
  port: 443,
  path: '/xmlrpc/2/object'
});

// Execute search_read
objectClient.methodCall('execute_kw', [
  database,
  uid,
  password,
  'pos.order',           // model name
  'search_read',         // method
  [[]],                  // domain (empty = all records)
  {                      // kwargs
    fields: ['name', 'date_order', 'amount_total'],
    limit: 100
  }
], (error, result) => {
  // result is array of records
});
```

### Odoo Domain Syntax

Domains filter records using a list of criteria:

```javascript
// Single condition
[['field', 'operator', 'value']]

// Multiple conditions (AND)
[
  ['state', '=', 'done'],
  ['date_order', '>=', '2025-01-01']
]

// OR conditions
['|',
  ['state', '=', 'draft'],
  ['state', '=', 'done']
]

// Common operators
'='   // equals
'!='  // not equals
'>'   // greater than
'>='  // greater than or equal
'<'   // less than
'<='  // less than or equal
'in'  // in list
'not in'  // not in list
'like'    // SQL LIKE
'ilike'   // case-insensitive LIKE
```

### Model Names Reference

| Business Object | Odoo Model | Notes |
|----------------|------------|-------|
| Partners (Customers) | `res.partner` | Customer data |
| POS Orders | `pos.order` | Restaurant orders |
| POS Order Lines | `pos.order.line` | Order items |
| POS Payments | `pos.payment` | Payment transactions |
| Invoices | `account.move` | Filter by `move_type='out_invoice'` |
| Products | `product.product` | Product catalog |
| Stock Quants | `stock.quant` | Stock levels |
| Stock Moves | `stock.move` | Inventory movements |
| Stock Pickings | `stock.picking` | Transfer orders |

### Fetching Related Data

The `getSaleOrders()` method demonstrates fetching related records:

```javascript
// 1. Get parent records (orders)
const orders = await this.searchRead('pos.order', [], fields, limit);

// 2. For each parent, fetch children
const ordersWithItems = await Promise.all(
  orders.map(async (order) => {
    const lineItems = await this.searchRead(
      'pos.order.line',
      [['order_id', '=', order.id]],  // Filter by parent ID
      ['product_id', 'qty', 'price_unit'],
      1000
    );

    return {
      ...order,
      order_items: lineItems
    };
  })
);
```

---

## Date Range Utilities

### Helper Function: `getDateRange()`

Parses query parameters and returns date range:

```javascript
function getDateRange(query) {
  const { year, month, quarter, start_date, end_date } = query;

  // Monthly
  if (year && month) {
    const range = dateUtils.getMonthRange(parseInt(year), parseInt(month));
    return {
      startDate: range.start.toISOString().split('T')[0],
      endDate: range.end.toISOString().split('T')[0]
    };
  }

  // Quarterly
  if (year && quarter) {
    const range = dateUtils.getQuarterRange(parseInt(year), parseInt(quarter));
    return {
      startDate: range.start.toISOString().split('T')[0],
      endDate: range.end.toISOString().split('T')[0]
    };
  }

  // Custom range
  if (start_date && end_date) {
    return {
      startDate: start_date,
      endDate: end_date
    };
  }

  // No date filter
  return {
    startDate: null,
    endDate: null
  };
}
```

### Date Utility Functions

**Get Month Range**
```javascript
getMonthRange: (year, month) => {
  // Returns first day 00:00 to last day 23:59:59.999
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}
```

**Get Quarter Range**
```javascript
getQuarterRange: (year, quarter) => {
  // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { start, end };
}
```

---

## Error Handling

### Global Error Handling Pattern

```javascript
app.get('/endpoint', async (req, res) => {
  try {
    // Attempt operation
    const result = await someAsyncOperation();

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    // Log error server-side
    console.error('Error description:', error.message);

    // Return user-friendly error
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### Odoo-Specific Error Handling

```javascript
try {
  await odooService.authenticate();
  console.log('Odoo authenticated successfully. User ID:', odooService.uid);
} catch (error) {
  console.error('Odoo authentication failed:', error.message);
  console.log('Server will continue without Odoo integration');
}
```

### Common Error Scenarios

| Error | Cause | Solution |
|-------|-------|----------|
| `Authentication failed` | Invalid Odoo credentials | Check `.env` file, use API key instead of password |
| `Object X doesn't exist` | Odoo module not installed | Install required module or use different model |
| `ECONNREFUSED` | External API down | Check API availability, implement retry logic |
| `CORS error` | Missing CORS headers | Already handled by `cors()` middleware |

---

## Testing

### Manual Testing with cURL

**Health Check**
```bash
curl http://localhost:3000/
```

**TopCare API**
```bash
curl http://localhost:3000/api/erbil
```

**Odoo with Date Range**
```bash
# Monthly
curl "http://localhost:3000/odoo/pos_orders?year=2025&month=11&limit=5"

# Quarterly
curl "http://localhost:3000/odoo/pos_orders?year=2025&quarter=4&limit=5"

# Custom range
curl "http://localhost:3000/odoo/pos_orders?start_date=2025-01-01&end_date=2025-01-31"
```

**Date Range Extraction**
```bash
# Monthly extraction
curl "http://localhost:3000/extract/monthly?location=erbil&year=2025&month=11"

# Quarterly extraction
curl "http://localhost:3000/extract/quarterly?location=duhok&year=2025&quarter=4"

# Custom date range
curl "http://localhost:3000/extract/date-range?location=bahrka&start_date=2025-01-01&end_date=2025-01-31"
```

### Testing Odoo Authentication

Use the provided test script:

```bash
node test-odoo-auth.js
```

This will:
- Load credentials from `.env`
- Attempt authentication
- Display success or failure with details
- Show user ID on success

### Testing with Frontend

```javascript
// React/Vue/Angular example
async function fetchPosOrders() {
  try {
    const response = await fetch(
      'https://your-proxy-domain.com/odoo/pos_orders?year=2025&month=11'
    );
    const data = await response.json();

    if (data.success) {
      console.log('Orders:', data.data);
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}
```

---

## Deployment

### Local Development

1. **Install dependencies**
```bash
npm install
```

2. **Create `.env` file**
```bash
ODOO_URL=https://chronoclash.odoo.com
ODOO_DB=chronoclash
ODOO_USER=software@pirmam.com
ODOO_PASSWORD=your_api_key_here
```

3. **Start server**
```bash
node server.js
```

Server runs on `http://localhost:3000`

### Docker Build

```bash
# Build image
docker build -t proxy-server .

# Run container
docker run -p 3000:3000 \
  -e ODOO_URL=https://chronoclash.odoo.com \
  -e ODOO_DB=chronoclash \
  -e ODOO_USER=software@pirmam.com \
  -e ODOO_PASSWORD=your_api_key \
  proxy-server
```

### Coolify Deployment

1. **Connect GitHub repository** in Coolify

2. **Set environment variables** in Coolify project settings:
   - `ODOO_URL`
   - `ODOO_DB`
   - `ODOO_USER`
   - `ODOO_PASSWORD`

3. **Deploy**
   - Coolify automatically detects Dockerfile
   - Builds and deploys on git push
   - Injects environment variables
   - Exposes port 3000

4. **Verify deployment**
```bash
curl https://your-domain.com/
```

Should return health check with `"status": "healthy"`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ODOO_URL` | Yes | Odoo instance URL (e.g., https://chronoclash.odoo.com) |
| `ODOO_DB` | Yes | Odoo database name |
| `ODOO_USER` | Yes | Odoo user email |
| `ODOO_PASSWORD` | Yes | Odoo API key (not regular password) |

---

## Troubleshooting

### Issue: "Authentication failed - invalid credentials"

**Cause**: Invalid Odoo credentials or using password instead of API key

**Solution**:
1. Generate API key in Odoo:
   - Log into Odoo
   - Go to Preferences → API Keys
   - Generate new key
   - Use this as `ODOO_PASSWORD`

2. Test credentials:
```bash
node test-odoo-auth.js
```

### Issue: "Object sale.order doesn't exist"

**Cause**: Sales module not installed in Odoo

**Solution**: This is expected. The `/odoo/sale_orders` endpoint automatically uses POS orders instead. No action needed.

### Issue: "EADDRINUSE: address already in use"

**Cause**: Port 3000 already in use

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or use a different port
PORT=3001 node server.js
```

### Issue: CORS errors in browser

**Cause**: Browser blocking cross-origin requests

**Solution**: CORS is already enabled. If still seeing errors:
1. Check browser console for specific error
2. Verify proxy server is running
3. Ensure request includes correct headers

### Issue: Empty data arrays returned

**Cause**: Date filters too restrictive or no data in range

**Solution**:
1. Remove date filters to check if data exists
2. Verify date format: YYYY-MM-DD
3. Check Odoo instance has data in the requested range

### Issue: Slow response times

**Cause**: Fetching too many records or related data

**Solution**:
1. Reduce `limit` parameter
2. Optimize Odoo queries (add indexes in Odoo)
3. Implement caching layer (Redis)
4. Use pagination for large datasets

---

## Performance Optimization

### Caching Strategy (Future Enhancement)

Consider adding Redis caching:

```javascript
const redis = require('redis');
const client = redis.createClient();

app.get('/api/erbil', async (req, res) => {
  const cacheKey = 'erbil-data';

  // Check cache
  const cached = await client.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // Fetch from API
  const response = await axios.get(TOPCARE_APIS.erbil);

  // Store in cache (5 minute TTL)
  await client.setEx(cacheKey, 300, JSON.stringify(response.data));

  res.json(response.data);
});
```

### Database Indexing

For optimal Odoo performance, ensure indexes exist on:
- `pos.order.date_order`
- `account.move.invoice_date`
- `stock.move.date`
- `pos.order.state`

### Load Balancing

For high traffic, consider:
1. Multiple server instances behind load balancer
2. Horizontal scaling with Docker Swarm or Kubernetes
3. CDN for static responses

---

## Security Considerations

### API Key Management

- Never commit `.env` to git (already in `.gitignore`)
- Use environment variables in all deployments
- Rotate API keys regularly
- Use read-only Odoo users for API access

### Input Validation

Add validation for user inputs:

```javascript
app.get('/odoo/pos_orders', async (req, res) => {
  // Validate limit
  const limit = Math.min(
    Math.max(parseInt(req.query.limit) || 100, 1),
    5000
  );

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (req.query.start_date && !dateRegex.test(req.query.start_date)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid date format. Use YYYY-MM-DD'
    });
  }

  // ... rest of handler
});
```

### Rate Limiting

Consider adding rate limiting:

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/odoo/', limiter);
```

---

## Contributing

### Code Style

- Use consistent indentation (2 spaces)
- Use async/await instead of callbacks
- Add JSDoc comments for functions
- Follow existing naming conventions

### Git Workflow

1. Create feature branch
```bash
git checkout -b feature/new-endpoint
```

2. Make changes and test

3. Commit with descriptive messages
```bash
git commit -m "Add product catalog endpoint to Odoo integration"
```

4. Push and create pull request
```bash
git push origin feature/new-endpoint
```

### Documentation Updates

When adding features:
1. Update this DEVELOPER_GUIDE.md with technical details
2. Update README.md with user-facing documentation
3. Add inline code comments for complex logic
4. Update health check endpoint if adding new routes

---

## Additional Resources

### Odoo Documentation
- [Odoo External API](https://www.odoo.com/documentation/16.0/developer/misc/api/odoo.html)
- [Odoo Models](https://www.odoo.com/documentation/16.0/developer/reference/backend/orm.html)

### Node.js Libraries
- [Express.js](https://expressjs.com/)
- [Axios](https://axios-http.com/)
- [xmlrpc](https://www.npmjs.com/package/xmlrpc)

### Docker
- [Dockerfile Reference](https://docs.docker.com/engine/reference/builder/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

## Support

For issues or questions:
1. Check this guide first
2. Review logs: `docker logs <container-id>`
3. Test with provided utilities: `node test-odoo-auth.js`
4. Check external API status
5. Create GitHub issue with:
   - Error message
   - Steps to reproduce
   - Server logs
   - Environment details

---

**Last Updated**: 2025-11-05

**Version**: 1.0.0
