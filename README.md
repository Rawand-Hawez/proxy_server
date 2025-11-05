# Dashboard Proxy Server

A CORS proxy server to handle HTTP API requests for the dashboard when hosted on HTTPS.

## Deployment on Coolify

1. Create a new service in Coolify
2. Select "Docker Compose" or "Dockerfile" deployment
3. Point to this `proxy-server` directory
4. Set the port to `3000`
5. Enable HTTPS/SSL via Coolify
6. Deploy

## Environment Variables

Create a `.env` file in the project root for Odoo ERP integration (optional):

```env
ODOO_URL=https://your-odoo-instance.odoo.com
ODOO_DB=your_database_name
ODOO_USER=your_email@example.com
ODOO_PASSWORD=your_password_or_api_key
```

**Note:** TopCare and Erbil Avenue API keys are embedded in the server code. Odoo credentials are optional - if not provided, Odoo endpoints will be disabled.

## Endpoints

### Health Check
- `GET /` - Returns server status and list of all available endpoints with documentation

### TopCare APIs (Erbil, Duhok, Bahrka)

#### Standard Proxy Endpoints
- `GET /api/erbil?endpoint=...&from=...&to=...` - Proxy for Erbil API (TopCare)
- `GET /api/duhok?endpoint=...&from=...&to=...` - Proxy for Duhok API (TopCare)
- `GET /api/bahrka?endpoint=...&from=...&to=...` - Proxy for Bahrka API (TopCare)

**Usage Example:**
```javascript
fetch('https://your-proxy-domain.com/api/erbil?endpoint=dashboard&from=2025-01-01&to=2025-01-31')
```

### Erbil Avenue (Supabase)

#### Resource Endpoints
- `GET /erbil-avenue/dashboard` - Supabase `v_dashboard` dataset (comprehensive operations and financial data)
- `GET /erbil-avenue/history` - Supabase `v_dashboard_history` dataset
- `GET /erbil-avenue/expected-rent` - Supabase `v_monthly_rent_breakdown` dataset

**Dashboard Data Structure:**
The `/erbil-avenue/dashboard` endpoint returns comprehensive property management data including:
- `operations`: Unit statistics by category (total, leased, occupied, vacant units)
- `financial`: Rent and service charge data including:
  - Current month snapshot (arrears, expected, collected)
  - 6-month historical trends
  - Expected monthly rent breakdown by tenant
  - Expected monthly service charge breakdown by tenant
  - Outstanding payments summary

For detailed response format, see [docs/erbil_avenue.md](docs/erbil_avenue.md)

**Usage Example:**
```javascript
// Get dashboard data with all operations and financial metrics
fetch('https://your-proxy-domain.com/erbil-avenue/dashboard')

// Get historical data
fetch('https://your-proxy-domain.com/erbil-avenue/history?select=*')
```

### Data Extraction Endpoints

#### Monthly Data Extraction
`GET /extract/monthly`

Extracts data for a specific calendar month. Automatically calculates the start and end dates for the month.

**Query Parameters:**
- `location` (required): `erbil`, `duhok`, `bahrka`, or `erbil-avenue`
- `year` (optional): Target year (defaults to current year)
- `month` (optional): Month number 1-12 (defaults to current month)
- `resource` (required for erbil-avenue): `dashboard`, `history`, or `expected-rent`

**Usage Examples:**

TopCare locations:
```javascript
// Get March 2025 data from Erbil
fetch('https://your-proxy-domain.com/extract/monthly?location=erbil&year=2025&month=3')

// Get current month data from Duhok
fetch('https://your-proxy-domain.com/extract/monthly?location=duhok')

// Get January 2025 data from Bahrka
fetch('https://your-proxy-domain.com/extract/monthly?location=bahrka&year=2025&month=1')
```

Erbil Avenue:
```javascript
// Get March 2025 history data
fetch('https://your-proxy-domain.com/extract/monthly?location=erbil-avenue&resource=history&year=2025&month=3')

// Get current month dashboard data
fetch('https://your-proxy-domain.com/extract/monthly?location=erbil-avenue&resource=dashboard')
```

**Response Format:**
```json
{
  "period": "monthly",
  "year": 2025,
  "month": 3,
  "dateRange": {
    "start": "2025-03-01T00:00:00.000Z",
    "end": "2025-03-31T23:59:59.999Z",
    "startFormatted": "2025-03-01",
    "endFormatted": "2025-03-31"
  },
  "location": "erbil",
  "data": [ /* API response data */ ]
}
```

#### Quarterly Data Extraction
`GET /extract/quarterly`

Extracts data for a specific quarter (Q1-Q4). Automatically calculates the start and end dates for the quarter.

**Quarters:**
- Q1: January - March
- Q2: April - June
- Q3: July - September
- Q4: October - December

**Query Parameters:**
- `location` (required): `erbil`, `duhok`, `bahrka`, or `erbil-avenue`
- `year` (optional): Target year (defaults to current year)
- `quarter` (optional): Quarter number 1-4 (defaults to current quarter)
- `resource` (required for erbil-avenue): `dashboard`, `history`, or `expected-rent`

**Usage Examples:**

TopCare locations:
```javascript
// Get Q1 2025 data from Erbil
fetch('https://your-proxy-domain.com/extract/quarterly?location=erbil&year=2025&quarter=1')

// Get current quarter data from Duhok
fetch('https://your-proxy-domain.com/extract/quarterly?location=duhok')

// Get Q3 2024 data from Bahrka
fetch('https://your-proxy-domain.com/extract/quarterly?location=bahrka&year=2024&quarter=3')
```

Erbil Avenue:
```javascript
// Get Q2 2025 history data
fetch('https://your-proxy-domain.com/extract/quarterly?location=erbil-avenue&resource=history&year=2025&quarter=2')

// Get current quarter expected rent data
fetch('https://your-proxy-domain.com/extract/quarterly?location=erbil-avenue&resource=expected-rent')
```

**Response Format:**
```json
{
  "period": "quarterly",
  "year": 2025,
  "quarter": 1,
  "dateRange": {
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-03-31T23:59:59.999Z",
    "startFormatted": "2025-01-01",
    "endFormatted": "2025-03-31"
  },
  "location": "erbil",
  "data": [ /* API response data */ ]
}
```

#### Custom Date Range Extraction
`GET /extract/date-range`

Extracts data for a custom date range. You can specify any start and end date.

**Query Parameters:**
- `location` (required): `erbil`, `duhok`, `bahrka`, or `erbil-avenue`
- `start_date` (required): Start date in YYYY-MM-DD format
- `end_date` (required): End date in YYYY-MM-DD format
- `resource` (required for erbil-avenue): `dashboard`, `history`, or `expected-rent`

**Usage Examples:**

TopCare locations:
```javascript
// Get data from January 1 to January 31, 2025 for Erbil
fetch('https://your-proxy-domain.com/extract/date-range?location=erbil&start_date=2025-01-01&end_date=2025-01-31')

// Get data for a 2-week period in Duhok
fetch('https://your-proxy-domain.com/extract/date-range?location=duhok&start_date=2025-01-15&end_date=2025-01-31')

// Get year-end data for Bahrka
fetch('https://your-proxy-domain.com/extract/date-range?location=bahrka&start_date=2024-12-15&end_date=2025-01-15')
```

Erbil Avenue:
```javascript
// Get history data for a custom range
fetch('https://your-proxy-domain.com/extract/date-range?location=erbil-avenue&resource=history&start_date=2025-01-15&end_date=2025-02-15')

// Get dashboard data for first week of the year
fetch('https://your-proxy-domain.com/extract/date-range?location=erbil-avenue&resource=dashboard&start_date=2025-01-01&end_date=2025-01-07')
```

**Response Format:**
```json
{
  "period": "custom",
  "dateRange": {
    "start": "2025-01-01T00:00:00.000Z",
    "end": "2025-01-31T23:59:59.999Z",
    "startFormatted": "2025-01-01",
    "endFormatted": "2025-01-31"
  },
  "location": "erbil",
  "data": [ /* API response data */ ]
}
```

**Validation:**
- Dates must be in YYYY-MM-DD format
- `start_date` must be before or equal to `end_date`
- Invalid dates will return a 400 error

### Odoo ERP Integration

The proxy server includes comprehensive Odoo ERP integration using XML-RPC API. All Odoo endpoints support date range filtering (monthly, quarterly, and custom date ranges).

#### Odoo Partners
`GET /odoo/partners`

Fetches customer partners from Odoo.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100)

**Usage Example:**
```javascript
fetch('https://your-proxy-domain.com/odoo/partners?limit=50')
```

#### Odoo Sale Orders (with Line Items)
`GET /odoo/sale_orders`

Fetches POS orders with line items included. Each order contains complete details including all products ordered.

> **💡 Note:** This endpoint returns POS orders (for restaurant/retail operations) with their line items. Each order includes an `order_items` array with product details (name, quantity, price, discount).

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)
- Date range options (choose one):
  - `year` & `month`: Monthly filter
  - `year` & `quarter`: Quarterly filter (1-4)
  - `start_date` & `end_date`: Custom date range (YYYY-MM-DD)

**Usage Examples:**
```javascript
// Get all sale orders with items
fetch('https://your-proxy-domain.com/odoo/sale_orders')

// Get sale orders for November 2025
fetch('https://your-proxy-domain.com/odoo/sale_orders?year=2025&month=11')

// Get sale orders for Q4 2025
fetch('https://your-proxy-domain.com/odoo/sale_orders?year=2025&quarter=4')

// Get sale orders for custom date range
fetch('https://your-proxy-domain.com/odoo/sale_orders?start_date=2025-01-01&end_date=2025-01-31')
```

**Response Format:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": 189,
      "name": "chronoclash - 000148",
      "partner_id": [15, "KRD Holding"],
      "date_order": "2025-11-05 11:42:01",
      "amount_total": 17550,
      "state": "done",
      "session_id": [22, "chronoclash/00018"],
      "order_items": [
        {
          "id": 412,
          "product_id": [16, "Chop Shop Salad"],
          "qty": 1,
          "price_unit": 7200,
          "price_subtotal": 7200,
          "price_subtotal_incl": 7200,
          "discount": 0
        },
        {
          "product_id": [6, "Classic Smash"],
          "qty": 1,
          "price_unit": 9000
        }
      ]
    }
  ]
}
```

#### Odoo Invoices
`GET /odoo/invoices`

Fetches outgoing invoices with optional date filtering.

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)
- Date range options: Same as sale orders

**Usage Examples:**
```javascript
// Get invoices for December 2025
fetch('https://your-proxy-domain.com/odoo/invoices?year=2025&month=12')

// Get invoices for Q1 2025
fetch('https://your-proxy-domain.com/odoo/invoices?year=2025&quarter=1')
```

#### Odoo POS Orders
`GET /odoo/pos_orders`

Fetches Point of Sale orders with optional date filtering.

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)
- Date range options: Same as sale orders

**Usage Examples:**
```javascript
// Get POS orders for today
const today = new Date().toISOString().split('T')[0];
fetch(`https://your-proxy-domain.com/odoo/pos_orders?start_date=${today}&end_date=${today}`)

// Get POS orders for November 2025
fetch('https://your-proxy-domain.com/odoo/pos_orders?year=2025&month=11')
```

#### Odoo POS Payments
`GET /odoo/pos_payments`

Fetches POS payment records with optional date filtering.

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)
- Date range options: Same as sale orders

#### Odoo POS Summary
`GET /odoo/pos_summary`

Returns aggregated POS metrics (total orders, revenue, average order value) with optional date filtering.

**Query Parameters:**
- Date range options: Same as sale orders

**Usage Example:**
```javascript
// Get POS summary for November 2025
fetch('https://your-proxy-domain.com/odoo/pos_summary?year=2025&month=11')
```

**Response Format:**
```json
{
  "success": true,
  "total_orders": 150,
  "total_revenue": 45000,
  "average_order_value": 300,
  "date_range": {
    "start": "2025-11-01",
    "end": "2025-11-30"
  }
}
```

#### Odoo POS Order Items
`GET /odoo/pos_order_items`

Fetches line items for a specific POS order.

**Query Parameters:**
- `order_id` (required): POS order ID
- `limit` (optional): Number of records (default: 100)

**Usage Example:**
```javascript
fetch('https://your-proxy-domain.com/odoo/pos_order_items?order_id=123')
```

#### Odoo POS Order with Items
`GET /odoo/pos_orders/:order_id/items`

Fetches a POS order with all its line items.

**Usage Example:**
```javascript
fetch('https://your-proxy-domain.com/odoo/pos_orders/123/items')
```

#### Odoo Inventory - Stock Levels
`GET /odoo/inventory/stock_levels`

Fetches current stock levels from inventory.

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)

#### Odoo Inventory - Stock Movements
`GET /odoo/inventory/movements`

Fetches completed stock movements.

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)

#### Odoo Inventory - Stock Pickings
`GET /odoo/inventory/pickings`

Fetches stock transfer records (pickings).

**Query Parameters:**
- `limit` (optional): Number of records (default: 100)

#### Odoo Inventory - Summary
`GET /odoo/inventory/summary`

Returns inventory summary grouped by product or location.

**Query Parameters:**
- `group_by` (optional): `product` or `location` (default: `product`)
- `limit` (optional): Number of records (default: 100)

**Usage Examples:**
```javascript
// Group by product
fetch('https://your-proxy-domain.com/odoo/inventory/summary?group_by=product')

// Group by location
fetch('https://your-proxy-domain.com/odoo/inventory/summary?group_by=location')
```

#### Odoo Dashboard
`GET /odoo/dashboard`

Returns quick dashboard metrics including customer count, sale orders, invoices, POS data, and total revenue.

**Response Format:**
```json
{
  "success": true,
  "customers": 450,
  "sale_orders": 120,
  "sale_revenue": 350000,
  "invoices": 95,
  "invoice_revenue": 280000,
  "pos_orders": 340,
  "pos_revenue": 125000,
  "total_revenue": 475000
}
```

#### Odoo Generic Model Access
`GET /odoo/model/:modelName`

Generic endpoint to access any Odoo model using search_read.

**Query Parameters:**
- `domain` (optional): JSON-encoded Odoo domain filter
- `fields` (optional): Comma-separated list of fields to return
- `limit` (optional): Number of records (default: 100)

**Usage Examples:**
```javascript
// Fetch products
fetch('https://your-proxy-domain.com/odoo/model/product.product?limit=50')

// Fetch products with specific fields
fetch('https://your-proxy-domain.com/odoo/model/product.product?fields=name,list_price,qty_available')

// Fetch products with domain filter
const domain = JSON.stringify([['list_price', '>', 100]]);
fetch(`https://your-proxy-domain.com/odoo/model/product.product?domain=${encodeURIComponent(domain)}`)
```

## Local Development

```bash
npm install
npm start
```

Or with auto-reload:

```bash
npm run dev
```

## Frontend Integration Guide

### Basic Setup

Update your dashboard configuration to use the proxy server:

```javascript
const PROXY_BASE_URL = 'https://your-proxy-domain.com';

const API_CONFIG = {
    topcare: {
        erbil: `${PROXY_BASE_URL}/api/erbil`,
        duhok: `${PROXY_BASE_URL}/api/duhok`,
        bahrka: `${PROXY_BASE_URL}/api/bahrka`
    },
    erbilAvenue: {
        dashboard: `${PROXY_BASE_URL}/erbil-avenue/dashboard`,
        history: `${PROXY_BASE_URL}/erbil-avenue/history`,
        expectedRent: `${PROXY_BASE_URL}/erbil-avenue/expected-rent`
    },
    extraction: {
        monthly: `${PROXY_BASE_URL}/extract/monthly`,
        quarterly: `${PROXY_BASE_URL}/extract/quarterly`,
        dateRange: `${PROXY_BASE_URL}/extract/date-range`
    },
    odoo: {
        partners: `${PROXY_BASE_URL}/odoo/partners`,
        saleOrders: `${PROXY_BASE_URL}/odoo/sale_orders`,
        invoices: `${PROXY_BASE_URL}/odoo/invoices`,
        posOrders: `${PROXY_BASE_URL}/odoo/pos_orders`,
        posPayments: `${PROXY_BASE_URL}/odoo/pos_payments`,
        posSummary: `${PROXY_BASE_URL}/odoo/pos_summary`,
        posOrderItems: `${PROXY_BASE_URL}/odoo/pos_order_items`,
        inventory: {
            stockLevels: `${PROXY_BASE_URL}/odoo/inventory/stock_levels`,
            movements: `${PROXY_BASE_URL}/odoo/inventory/movements`,
            pickings: `${PROXY_BASE_URL}/odoo/inventory/pickings`,
            summary: `${PROXY_BASE_URL}/odoo/inventory/summary`
        },
        dashboard: `${PROXY_BASE_URL}/odoo/dashboard`,
        model: (modelName) => `${PROXY_BASE_URL}/odoo/model/${modelName}`
    }
};
```

### Example: Monthly Data Extraction

```javascript
// Function to fetch monthly data
async function fetchMonthlyData(location, year, month, resource = null) {
    const params = new URLSearchParams({
        location,
        ...(year && { year }),
        ...(month && { month }),
        ...(resource && { resource })
    });

    const response = await fetch(`${API_CONFIG.extraction.monthly}?${params}`);
    const data = await response.json();

    return data;
}

// Usage examples:
// Get current month data for Erbil
const currentMonthData = await fetchMonthlyData('erbil');

// Get specific month data for Duhok
const marchData = await fetchMonthlyData('duhok', 2025, 3);

// Get Erbil Avenue history for current month
const erbilAvenueData = await fetchMonthlyData('erbil-avenue', null, null, 'history');
```

### Example: Quarterly Data Extraction

```javascript
// Function to fetch quarterly data
async function fetchQuarterlyData(location, year, quarter, resource = null) {
    const params = new URLSearchParams({
        location,
        ...(year && { year }),
        ...(quarter && { quarter }),
        ...(resource && { resource })
    });

    const response = await fetch(`${API_CONFIG.extraction.quarterly}?${params}`);
    const data = await response.json();

    return data;
}

// Usage examples:
// Get current quarter data for Erbil
const currentQuarterData = await fetchQuarterlyData('erbil');

// Get Q1 2025 data for Bahrka
const q1Data = await fetchQuarterlyData('bahrka', 2025, 1);

// Get Q2 2025 expected rent for Erbil Avenue
const q2RentData = await fetchQuarterlyData('erbil-avenue', 2025, 2, 'expected-rent');
```

### Example: Custom Date Range Extraction

```javascript
// Function to fetch custom date range data
async function fetchDateRangeData(location, startDate, endDate, resource = null) {
    const params = new URLSearchParams({
        location,
        start_date: startDate,
        end_date: endDate,
        ...(resource && { resource })
    });

    const response = await fetch(`${API_CONFIG.extraction.dateRange}?${params}`);
    const data = await response.json();

    return data;
}

// Usage examples:
// Get data for January 2025 from Erbil
const januaryData = await fetchDateRangeData('erbil', '2025-01-01', '2025-01-31');

// Get data for a 2-week period from Duhok
const twoWeekData = await fetchDateRangeData('duhok', '2025-01-15', '2025-01-31');

// Get Erbil Avenue history for custom date range
const customRangeData = await fetchDateRangeData('erbil-avenue', '2025-01-15', '2025-02-15', 'history');

// Get data for last 7 days
function getLast7Days() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const format = (date) => date.toISOString().split('T')[0];
    return fetchDateRangeData('erbil', format(startDate), format(endDate));
}

// Get data for last 30 days
function getLast30Days(location) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const format = (date) => date.toISOString().split('T')[0];
    return fetchDateRangeData(location, format(startDate), format(endDate));
}
```

### Example: Building a Date Range Selector

```javascript
// Component for monthly/quarterly selection
class DataExtractor {
    constructor(location, resource = null) {
        this.location = location;
        this.resource = resource;
    }

    async getCurrentMonth() {
        return await fetchMonthlyData(this.location, null, null, this.resource);
    }

    async getCurrentQuarter() {
        return await fetchQuarterlyData(this.location, null, null, this.resource);
    }

    async getMonth(year, month) {
        return await fetchMonthlyData(this.location, year, month, this.resource);
    }

    async getQuarter(year, quarter) {
        return await fetchQuarterlyData(this.location, year, quarter, this.resource);
    }

    async getLastNMonths(n) {
        const results = [];
        const now = new Date();

        for (let i = 0; i < n; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const data = await this.getMonth(date.getFullYear(), date.getMonth() + 1);
            results.push(data);
        }

        return results;
    }

    async getDateRange(startDate, endDate) {
        return await fetchDateRangeData(this.location, startDate, endDate, this.resource);
    }

    async getLastNDays(n) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - n);

        const format = (date) => date.toISOString().split('T')[0];
        return await this.getDateRange(format(startDate), format(endDate));
    }

    async getLastWeek() {
        return await this.getLastNDays(7);
    }

    async getLast30Days() {
        return await this.getLastNDays(30);
    }
}

// Usage:
const erbilExtractor = new DataExtractor('erbil');
const last3Months = await erbilExtractor.getLastNMonths(3);
const lastWeek = await erbilExtractor.getLastWeek();
const customRange = await erbilExtractor.getDateRange('2025-01-01', '2025-01-31');

const erbilAvenueExtractor = new DataExtractor('erbil-avenue', 'history');
const currentMonthHistory = await erbilAvenueExtractor.getCurrentMonth();
const last30Days = await erbilAvenueExtractor.getLast30Days();
```

### Error Handling

```javascript
async function fetchDataWithErrorHandling(url) {
    try {
        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to fetch data');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);

        // Handle specific error cases
        if (error.message.includes('Gateway timeout')) {
            alert('The server is taking too long to respond. Please try again.');
        } else if (error.message.includes('Location not found')) {
            alert('Invalid location specified.');
        } else {
            alert('An error occurred while fetching data.');
        }

        throw error;
    }
}
```

### Response Data Structure

All extraction endpoints return consistent data structure:

```typescript
interface ExtractionResponse {
    period: 'monthly' | 'quarterly' | 'custom';
    year?: number;         // Only for monthly/quarterly
    month?: number;        // Only for monthly
    quarter?: number;      // Only for quarterly
    dateRange: {
        start: string;           // ISO 8601 format
        end: string;             // ISO 8601 format
        startFormatted: string;  // YYYY-MM-DD format
        endFormatted: string;    // YYYY-MM-DD format
    };
    location: string;
    resource?: string;     // Only for erbil-avenue
    data: any[];          // Actual API response data
}
```

**Period Types:**
- `monthly`: Data extracted for a calendar month (includes `year` and `month`)
- `quarterly`: Data extracted for a quarter (includes `year` and `quarter`)
- `custom`: Data extracted for a custom date range (no `year`, `month`, or `quarter`)

### Common Use Cases

#### 1. Year-to-Date Report
```javascript
async function getYearToDateData(location) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const monthlyData = [];
    for (let month = 1; month <= currentMonth; month++) {
        const data = await fetchMonthlyData(location, currentYear, month);
        monthlyData.push(data);
    }

    return monthlyData;
}
```

#### 2. Quarterly Comparison
```javascript
async function compareQuarters(location, year) {
    const quarters = [1, 2, 3, 4];
    const quarterlyData = await Promise.all(
        quarters.map(q => fetchQuarterlyData(location, year, q))
    );

    return quarterlyData;
}
```

#### 3. Multi-Location Dashboard
```javascript
async function getAllLocationsCurrentMonth() {
    const locations = ['erbil', 'duhok', 'bahrka'];

    const data = await Promise.all(
        locations.map(location => fetchMonthlyData(location))
    );

    return locations.reduce((acc, location, index) => {
        acc[location] = data[index];
        return acc;
    }, {});
}
```

#### 4. Custom Date Range Reports
```javascript
// Week-over-week comparison
async function getWeekOverWeekComparison(location) {
    const endDate = new Date();
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - 7);

    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - 14);

    const lastWeekEnd = new Date();
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 8);

    const format = (date) => date.toISOString().split('T')[0];

    const [thisWeek, lastWeek] = await Promise.all([
        fetchDateRangeData(location, format(thisWeekStart), format(endDate)),
        fetchDateRangeData(location, format(lastWeekStart), format(lastWeekEnd))
    ]);

    return { thisWeek, lastWeek };
}

// Custom fiscal period
async function getFiscalPeriod(location, fiscalStartMonth) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Determine fiscal year
    const fiscalYear = currentMonth >= fiscalStartMonth - 1 ? currentYear : currentYear - 1;

    const startDate = new Date(fiscalYear, fiscalStartMonth - 1, 1);
    const endDate = new Date(fiscalYear + 1, fiscalStartMonth - 1, 0);

    const format = (date) => date.toISOString().split('T')[0];

    return await fetchDateRangeData(location, format(startDate), format(endDate));
}

// Date range with automatic "rolling window"
async function getRollingWindow(location, days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const format = (date) => date.toISOString().split('T')[0];
    return await fetchDateRangeData(location, format(startDate), format(endDate));
}
```

#### 5. Odoo ERP Data Integration
```javascript
// Fetch Odoo POS orders for current month
async function getOdooCurrentMonthPOS() {
    const now = new Date();
    const params = new URLSearchParams({
        year: now.getFullYear(),
        month: now.getMonth() + 1
    });

    const response = await fetch(`${API_CONFIG.odoo.posOrders}?${params}`);
    return await response.json();
}

// Fetch Odoo sales summary for Q4 2025
async function getOdooQ4Sales() {
    const response = await fetch(`${API_CONFIG.odoo.saleOrders}?year=2025&quarter=4`);
    return await response.json();
}

// Fetch Odoo dashboard metrics
async function getOdooDashboard() {
    const response = await fetch(API_CONFIG.odoo.dashboard);
    return await response.json();
}

// Fetch specific Odoo model data
async function getOdooProducts() {
    const url = API_CONFIG.odoo.model('product.product');
    const params = new URLSearchParams({
        fields: 'name,list_price,qty_available',
        limit: 100
    });

    const response = await fetch(`${url}?${params}`);
    return await response.json();
}

// Combined dashboard with all data sources
async function getCompleteDashboard() {
    const [topcare, erbilAvenue, odoo] = await Promise.all([
        getAllLocationsCurrentMonth(), // TopCare data
        fetch(API_CONFIG.erbilAvenue.dashboard).then(r => r.json()), // Erbil Avenue
        fetch(API_CONFIG.odoo.dashboard).then(r => r.json()) // Odoo ERP
    ]);

    return {
        topcare,
        erbilAvenue,
        odoo
    };
}
```
