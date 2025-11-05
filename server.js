require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OdooService = require('./odooService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Odoo Service
let odooService = null;
if (process.env.ODOO_URL && process.env.ODOO_DB && process.env.ODOO_USER && process.env.ODOO_PASSWORD) {
  odooService = new OdooService(
    process.env.ODOO_URL,
    process.env.ODOO_DB,
    process.env.ODOO_USER,
    process.env.ODOO_PASSWORD
  );
  console.log('Odoo service initialized');
} else {
  console.warn('Odoo credentials not found in .env - Odoo endpoints will be disabled');
}

// Date utility functions for monthly and quarterly data extraction
const dateUtils = {
  // Get start and end dates for a specific calendar month
  getMonthRange: (year, month) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startFormatted: startDate.toISOString().split('T')[0],
      endFormatted: endDate.toISOString().split('T')[0]
    };
  },

  // Get start and end dates for a specific quarter (1-4)
  getQuarterRange: (year, quarter) => {
    if (quarter < 1 || quarter > 4) {
      throw new Error('Quarter must be between 1 and 4');
    }
    const startMonth = (quarter - 1) * 3;
    const startDate = new Date(year, startMonth, 1);
    const endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startFormatted: startDate.toISOString().split('T')[0],
      endFormatted: endDate.toISOString().split('T')[0]
    };
  },

  // Get current month range
  getCurrentMonthRange: () => {
    const now = new Date();
    return dateUtils.getMonthRange(now.getFullYear(), now.getMonth() + 1);
  },

  // Get current quarter range
  getCurrentQuarterRange: () => {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3) + 1;
    return dateUtils.getQuarterRange(now.getFullYear(), quarter);
  }
};

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Dashboard Proxy Server is running',
    odoo_configured: !!odooService,
    endpoints: {
      topcare: {
        erbil: '/api/erbil',
        duhok: '/api/duhok',
        bahrka: '/api/bahrka'
      },
      erbilAvenue: {
        dashboard: '/erbil-avenue/dashboard',
        history: '/erbil-avenue/history',
        expectedRent: '/erbil-avenue/expected-rent'
      },
      dataExtraction: {
        monthly: {
          description: 'Extract data for a specific calendar month',
          examples: [
            '/extract/monthly?location=erbil&year=2025&month=3',
            '/extract/monthly?location=erbil-avenue&resource=history&year=2025&month=3',
            '/extract/monthly?location=duhok (defaults to current month)'
          ],
          parameters: {
            location: 'required (erbil, duhok, bahrka, or erbil-avenue)',
            year: 'optional (defaults to current year)',
            month: 'optional (1-12, defaults to current month)',
            resource: 'required for erbil-avenue (dashboard, history, expected-rent)'
          }
        },
        quarterly: {
          description: 'Extract data for a specific quarter',
          examples: [
            '/extract/quarterly?location=erbil&year=2025&quarter=1',
            '/extract/quarterly?location=erbil-avenue&resource=history&year=2025&quarter=2',
            '/extract/quarterly?location=bahrka (defaults to current quarter)'
          ],
          parameters: {
            location: 'required (erbil, duhok, bahrka, or erbil-avenue)',
            year: 'optional (defaults to current year)',
            quarter: 'optional (1-4, defaults to current quarter)',
            resource: 'required for erbil-avenue (dashboard, history, expected-rent)'
          }
        },
        dateRange: {
          description: 'Extract data for a custom date range',
          examples: [
            '/extract/date-range?location=erbil&start_date=2025-01-01&end_date=2025-01-31',
            '/extract/date-range?location=erbil-avenue&resource=history&start_date=2025-01-15&end_date=2025-02-15',
            '/extract/date-range?location=duhok&start_date=2024-12-01&end_date=2025-01-15'
          ],
          parameters: {
            location: 'required (erbil, duhok, bahrka, or erbil-avenue)',
            start_date: 'required (format: YYYY-MM-DD)',
            end_date: 'required (format: YYYY-MM-DD)',
            resource: 'required for erbil-avenue (dashboard, history, expected-rent)'
          }
        }
      },
      odoo: odooService ? {
        partners: '/odoo/partners',
        sale_orders: '/odoo/sale_orders',
        invoices: '/odoo/invoices',
        pos_orders: '/odoo/pos_orders',
        pos_payments: '/odoo/pos_payments',
        pos_summary: '/odoo/pos_summary',
        pos_order_items: '/odoo/pos_order_items?order_id={id}',
        pos_order_with_items: '/odoo/pos_orders/{id}/items',
        inventory: {
          stock_levels: '/odoo/inventory/stock_levels',
          movements: '/odoo/inventory/movements',
          pickings: '/odoo/inventory/pickings',
          summary: '/odoo/inventory/summary?group_by=product|location'
        },
        dashboard: '/odoo/dashboard',
        generic_model: '/odoo/model/{modelName}',
        date_range_support: {
          description: 'All POS, sales, and invoice endpoints support date filtering',
          parameters: {
            monthly: 'year={year}&month={month}',
            quarterly: 'year={year}&quarter={quarter}',
            custom: 'start_date={YYYY-MM-DD}&end_date={YYYY-MM-DD}'
          },
          examples: [
            '/odoo/pos_orders?year=2025&month=11',
            '/odoo/sale_orders?year=2025&quarter=4',
            '/odoo/invoices?start_date=2025-01-01&end_date=2025-01-31'
          ]
        }
      } : 'Odoo not configured'
    }
  });
});

// Proxy configuration for each TopCare location
const TOPCARE_APIS = {
  erbil: {
    url: 'http://185.24.63.6:8080/Gigant/apps/lab/api/dashboard.php',
    apiKey: '2df47bed2e4e1ce0db710bef576d053df742e0effe0f22cad3b997bc21ab3de3'
  },
  duhok: {
    url: 'http://185.24.63.6:8081/Gigant/apps/lab/api/dashboard.php',
    apiKey: '411b13ef9f0d0c172c66990cc75f9b817fc822bca10419baf772f7709de433d0'
  },
  bahrka: {
    url: 'http://185.24.63.6:8082/Gigant/apps/lab/api/dashboard.php',
    apiKey: 'f96711c48d4e99d98e9567da853781e7fef3b89c85d47e3071bfbc914f38a05b'
  }
};

const ERBIL_AVENUE_API = {
  baseUrl: 'https://easupabase.krdholding.dev/rest/v1',
  apiKey: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc1NTk0NTEyMCwiZXhwIjo0OTExNjE4NzIwLCJyb2xlIjoiYW5vbiJ9.0NKTsplZZXrOF3l7sXHCS07TsMVsIVczMrkJmvuEspw',
  endpoints: {
    dashboard: {
      path: '/v_dashboard',
      defaultParams: { select: '*' }
    },
    history: {
      path: '/v_dashboard_history',
      defaultParams: { select: '*' }
    },
    'expected-rent': {
      path: '/v_monthly_rent_breakdown',
      defaultParams: { select: '*' }
    }
  }
};

// Monthly data extraction endpoint
// Usage: /extract/monthly?location=erbil&year=2025&month=3
// Or: /extract/monthly?location=erbil-avenue&resource=history&year=2025&month=3
app.get('/extract/monthly', async (req, res) => {
  const { location, year, month, resource } = req.query;

  if (!location) {
    return res.status(400).json({ error: 'Location parameter is required' });
  }

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const targetYear = year ? parseInt(year) : currentYear;
  const targetMonth = month ? parseInt(month) : currentMonth;

  if (targetMonth < 1 || targetMonth > 12) {
    return res.status(400).json({ error: 'Month must be between 1 and 12' });
  }

  try {
    const dateRange = dateUtils.getMonthRange(targetYear, targetMonth);

    if (location === 'erbil-avenue') {
      if (!resource) {
        return res.status(400).json({ error: 'Resource parameter is required for erbil-avenue' });
      }

      const endpoint = ERBIL_AVENUE_API.endpoints[resource];
      if (!endpoint) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      const queryParams = new URLSearchParams({
        ...endpoint.defaultParams,
        ...req.query
      });

      const url = `${ERBIL_AVENUE_API.baseUrl}${endpoint.path}?${queryParams.toString()}`;

      console.log(`[${new Date().toISOString()}] Monthly extraction (${targetYear}-${targetMonth}) for Erbil Avenue: ${url}`);

      const response = await axios.get(url, {
        headers: {
          apikey: ERBIL_AVENUE_API.apiKey,
          Authorization: `Bearer ${ERBIL_AVENUE_API.apiKey}`
        },
        timeout: 30000
      });

      res.json({
        period: 'monthly',
        year: targetYear,
        month: targetMonth,
        dateRange,
        location: 'erbil-avenue',
        resource,
        data: response.data
      });
    } else {
      const config = TOPCARE_APIS[location];
      if (!config) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const queryParams = new URLSearchParams({
        start_date: dateRange.startFormatted,
        end_date: dateRange.endFormatted
      }).toString();

      const fullUrl = `${config.url}?${queryParams}`;

      console.log(`[${new Date().toISOString()}] Monthly extraction (${targetYear}-${targetMonth}) for ${location}: ${fullUrl}`);

      const response = await axios.get(fullUrl, {
        headers: {
          'X-API-Key': config.apiKey
        },
        timeout: 30000
      });

      res.json({
        period: 'monthly',
        year: targetYear,
        month: targetMonth,
        dateRange,
        location,
        data: response.data
      });
    }
  } catch (error) {
    console.error(`Error extracting monthly data for ${location}:`, error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      res.status(504).json({
        error: 'Gateway timeout - no response from API server',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Quarterly data extraction endpoint
// Usage: /extract/quarterly?location=erbil&year=2025&quarter=1
// Or: /extract/quarterly?location=erbil-avenue&resource=history&year=2025&quarter=1
app.get('/extract/quarterly', async (req, res) => {
  const { location, year, quarter, resource } = req.query;

  if (!location) {
    return res.status(400).json({ error: 'Location parameter is required' });
  }

  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  const targetYear = year ? parseInt(year) : currentYear;
  const targetQuarter = quarter ? parseInt(quarter) : currentQuarter;

  if (targetQuarter < 1 || targetQuarter > 4) {
    return res.status(400).json({ error: 'Quarter must be between 1 and 4' });
  }

  try {
    const dateRange = dateUtils.getQuarterRange(targetYear, targetQuarter);

    if (location === 'erbil-avenue') {
      if (!resource) {
        return res.status(400).json({ error: 'Resource parameter is required for erbil-avenue' });
      }

      const endpoint = ERBIL_AVENUE_API.endpoints[resource];
      if (!endpoint) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      const queryParams = new URLSearchParams({
        ...endpoint.defaultParams,
        ...req.query
      });

      const url = `${ERBIL_AVENUE_API.baseUrl}${endpoint.path}?${queryParams.toString()}`;

      console.log(`[${new Date().toISOString()}] Quarterly extraction (${targetYear}-Q${targetQuarter}) for Erbil Avenue: ${url}`);

      const response = await axios.get(url, {
        headers: {
          apikey: ERBIL_AVENUE_API.apiKey,
          Authorization: `Bearer ${ERBIL_AVENUE_API.apiKey}`
        },
        timeout: 30000
      });

      res.json({
        period: 'quarterly',
        year: targetYear,
        quarter: targetQuarter,
        dateRange,
        location: 'erbil-avenue',
        resource,
        data: response.data
      });
    } else {
      const config = TOPCARE_APIS[location];
      if (!config) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const queryParams = new URLSearchParams({
        start_date: dateRange.startFormatted,
        end_date: dateRange.endFormatted
      }).toString();

      const fullUrl = `${config.url}?${queryParams}`;

      console.log(`[${new Date().toISOString()}] Quarterly extraction (${targetYear}-Q${targetQuarter}) for ${location}: ${fullUrl}`);

      const response = await axios.get(fullUrl, {
        headers: {
          'X-API-Key': config.apiKey
        },
        timeout: 30000
      });

      res.json({
        period: 'quarterly',
        year: targetYear,
        quarter: targetQuarter,
        dateRange,
        location,
        data: response.data
      });
    }
  } catch (error) {
    console.error(`Error extracting quarterly data for ${location}:`, error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      res.status(504).json({
        error: 'Gateway timeout - no response from API server',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Date-to-date range extraction endpoint
// Usage: /extract/date-range?location=erbil&start_date=2025-01-01&end_date=2025-01-31
// Or: /extract/date-range?location=erbil-avenue&resource=history&start_date=2025-01-01&end_date=2025-01-31
app.get('/extract/date-range', async (req, res) => {
  const { location, start_date, end_date, resource } = req.query;

  if (!location) {
    return res.status(400).json({ error: 'Location parameter is required' });
  }

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'Both start_date and end_date parameters are required (format: YYYY-MM-DD)' });
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(start_date) || !dateRegex.test(end_date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD format' });
  }

  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  // Validate dates
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date values' });
  }

  if (startDate > endDate) {
    return res.status(400).json({ error: 'start_date must be before or equal to end_date' });
  }

  try {
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);

    const dateRange = {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      startFormatted: start_date,
      endFormatted: end_date
    };

    if (location === 'erbil-avenue') {
      if (!resource) {
        return res.status(400).json({ error: 'Resource parameter is required for erbil-avenue' });
      }

      const endpoint = ERBIL_AVENUE_API.endpoints[resource];
      if (!endpoint) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      const queryParams = new URLSearchParams({
        ...endpoint.defaultParams,
        ...req.query
      });

      const url = `${ERBIL_AVENUE_API.baseUrl}${endpoint.path}?${queryParams.toString()}`;

      console.log(`[${new Date().toISOString()}] Date range extraction (${start_date} to ${end_date}) for Erbil Avenue: ${url}`);

      const response = await axios.get(url, {
        headers: {
          apikey: ERBIL_AVENUE_API.apiKey,
          Authorization: `Bearer ${ERBIL_AVENUE_API.apiKey}`
        },
        timeout: 30000
      });

      res.json({
        period: 'custom',
        dateRange,
        location: 'erbil-avenue',
        resource,
        data: response.data
      });
    } else {
      const config = TOPCARE_APIS[location];
      if (!config) {
        return res.status(404).json({ error: 'Location not found' });
      }

      const queryParams = new URLSearchParams({
        start_date: dateRange.startFormatted,
        end_date: dateRange.endFormatted
      }).toString();

      const fullUrl = `${config.url}?${queryParams}`;

      console.log(`[${new Date().toISOString()}] Date range extraction (${start_date} to ${end_date}) for ${location}: ${fullUrl}`);

      const response = await axios.get(fullUrl, {
        headers: {
          'X-API-Key': config.apiKey
        },
        timeout: 30000
      });

      res.json({
        period: 'custom',
        dateRange,
        location,
        data: response.data
      });
    }
  } catch (error) {
    console.error(`Error extracting date range data for ${location}:`, error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      res.status(504).json({
        error: 'Gateway timeout - no response from API server',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

app.get('/erbil-avenue/:resource', async (req, res) => {
  const { resource } = req.params;
  const endpoint = ERBIL_AVENUE_API.endpoints[resource];

  if (!endpoint) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  try {
    const queryParams = new URLSearchParams({
      ...endpoint.defaultParams,
      ...req.query
    });

    const url = `${ERBIL_AVENUE_API.baseUrl}${endpoint.path}?${queryParams.toString()}`;

    console.log(`[${new Date().toISOString()}] Proxying Erbil Avenue request to: ${url}`);

    const response = await axios.get(url, {
      headers: {
        apikey: ERBIL_AVENUE_API.apiKey,
        Authorization: `Bearer ${ERBIL_AVENUE_API.apiKey}`
      },
      timeout: 30000
    });

    res.json(response.data);
  } catch (error) {
    console.error(`Error proxying Erbil Avenue resource (${resource}):`, error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      res.status(504).json({
        error: 'Gateway timeout - no response from Erbil Avenue API',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Generic proxy endpoint - catch all paths after location
app.get('/api/:location/*', async (req, res) => {
  const { location } = req.params;
  const config = TOPCARE_APIS[location];

  if (!config) {
    return res.status(404).json({ error: 'Location not found' });
  }

  try {
    // Extract the endpoint path after /api/:location
    const endpoint = req.params[0] ? `/${req.params[0]}` : '';

    // Build the full URL with endpoint and query parameters
    const queryParams = new URLSearchParams(req.query).toString();
    const fullUrl = `${config.url}${endpoint}${queryParams ? '?' + queryParams : ''}`;

    console.log(`[${new Date().toISOString()}] Proxying request to: ${fullUrl}`);

    // Make request to the HTTP API
    const response = await axios.get(fullUrl, {
      headers: {
        'X-API-Key': config.apiKey
      },
      timeout: 30000 // 30 second timeout
    });

    // Forward the response
    res.json(response.data);
  } catch (error) {
    console.error(`Error proxying request for ${location}:`, error.message);

    if (error.response) {
      // Forward the error response from the API
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // Request was made but no response received
      res.status(504).json({
        error: 'Gateway timeout - no response from API server',
        details: error.message
      });
    } else {
      // Something else happened
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Fallback for requests without additional path
app.get('/api/:location', async (req, res) => {
  const { location } = req.params;
  const config = TOPCARE_APIS[location];

  if (!config) {
    return res.status(404).json({ error: 'Location not found' });
  }

  try {
    const queryParams = new URLSearchParams(req.query).toString();
    const fullUrl = `${config.url}${queryParams ? '?' + queryParams : ''}`;

    console.log(`[${new Date().toISOString()}] Proxying request to: ${fullUrl}`);

    const response = await axios.get(fullUrl, {
      headers: {
        'X-API-Key': config.apiKey
      },
      timeout: 30000
    });

    res.json(response.data);
  } catch (error) {
    console.error(`Error proxying request for ${location}:`, error.message);

    if (error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      res.status(504).json({
        error: 'Gateway timeout - no response from API server',
        details: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// ============================================
// ODOO ERP INTEGRATION ENDPOINTS
// ============================================

// Middleware to check if Odoo is configured
const checkOdooConfigured = (req, res, next) => {
  if (!odooService) {
    return res.status(503).json({
      success: false,
      error: 'Odoo integration is not configured. Please check your .env file.'
    });
  }
  next();
};

// Helper function to parse date range from query params
const getDateRange = (req) => {
  const { year, month, quarter, start_date, end_date } = req.query;

  if (start_date && end_date) {
    // Custom date range
    return { start: start_date, end: end_date };
  } else if (year && month) {
    // Monthly range
    const targetYear = parseInt(year);
    const targetMonth = parseInt(month);
    const range = dateUtils.getMonthRange(targetYear, targetMonth);
    return { start: range.startFormatted, end: range.endFormatted };
  } else if (year && quarter) {
    // Quarterly range
    const targetYear = parseInt(year);
    const targetQuarter = parseInt(quarter);
    const range = dateUtils.getQuarterRange(targetYear, targetQuarter);
    return { start: range.startFormatted, end: range.endFormatted };
  }

  return { start: null, end: null };
};

// GET /odoo/partners - Fetch customer partners
app.get('/odoo/partners', checkOdooConfigured, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const partners = await odooService.getPartners(limit);

    res.json({
      success: true,
      count: partners.length,
      data: partners
    });
  } catch (error) {
    console.error('Error fetching Odoo partners:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/sale_orders - Fetch sale orders with optional date filtering
app.get('/odoo/sale_orders', checkOdooConfigured, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { start, end } = getDateRange(req);

    const orders = await odooService.getSaleOrders(limit, start, end);

    res.json({
      success: true,
      count: orders.length,
      ...(start && end && { date_range: { start, end } }),
      data: orders
    });
  } catch (error) {
    console.error('Error fetching Odoo sale orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/invoices - Fetch invoices with optional date filtering
app.get('/odoo/invoices', checkOdooConfigured, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { start, end } = getDateRange(req);

    const invoices = await odooService.getInvoices(limit, start, end);

    res.json({
      success: true,
      count: invoices.length,
      ...(start && end && { date_range: { start, end } }),
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching Odoo invoices:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/pos_orders - Fetch POS orders with optional date filtering
app.get('/odoo/pos_orders', checkOdooConfigured, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { start, end } = getDateRange(req);

    const orders = await odooService.getPosOrders(limit, start, end);

    res.json({
      success: true,
      count: orders.length,
      ...(start && end && { date_range: { start, end } }),
      data: orders
    });
  } catch (error) {
    console.error('Error fetching Odoo POS orders:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/pos_payments - Fetch POS payments with optional date filtering
app.get('/odoo/pos_payments', checkOdooConfigured, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const { start, end } = getDateRange(req);

    const payments = await odooService.getPosPayments(limit, start, end);

    res.json({
      success: true,
      count: payments.length,
      ...(start && end && { date_range: { start, end } }),
      data: payments
    });
  } catch (error) {
    console.error('Error fetching Odoo POS payments:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/pos_summary - Aggregated POS summary with optional date filtering
app.get('/odoo/pos_summary', checkOdooConfigured, async (req, res) => {
  try {
    const { start, end } = getDateRange(req);
    const summary = await odooService.getPosSummary(start, end);

    res.json(summary);
  } catch (error) {
    console.error('Error fetching Odoo POS summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/pos_order_items - Fetch line items for a POS order
app.get('/odoo/pos_order_items', checkOdooConfigured, async (req, res) => {
  try {
    const { order_id } = req.query;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        error: 'order_id parameter is required'
      });
    }

    const limit = parseInt(req.query.limit) || 100;
    const items = await odooService.getPosOrderItems(order_id, limit);

    res.json({
      success: true,
      order_id: parseInt(order_id),
      count: items.length,
      data: items
    });
  } catch (error) {
    console.error('Error fetching Odoo POS order items:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/pos_orders/:order_id/items - Fetch POS order with its line items
app.get('/odoo/pos_orders/:order_id/items', checkOdooConfigured, async (req, res) => {
  try {
    const orderId = req.params.order_id;
    const limit = parseInt(req.query.limit) || 100;

    const [order, items] = await Promise.all([
      odooService.searchRead('pos.order', [['id', '=', parseInt(orderId)]], [], 1),
      odooService.getPosOrderItems(orderId, limit)
    ]);

    if (order.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: order[0],
      items_count: items.length,
      items: items
    });
  } catch (error) {
    console.error('Error fetching Odoo POS order with items:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/inventory/stock_levels - Fetch stock levels
app.get('/odoo/inventory/stock_levels', checkOdooConfigured, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const stockLevels = await odooService.getStockLevels(limit);

    res.json({
      success: true,
      count: stockLevels.length,
      data: stockLevels
    });
  } catch (error) {
    console.error('Error fetching Odoo stock levels:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/inventory/movements - Fetch stock movements
app.get('/odoo/inventory/movements', checkOdooConfigured, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const movements = await odooService.getStockMovements(limit);

    res.json({
      success: true,
      count: movements.length,
      data: movements
    });
  } catch (error) {
    console.error('Error fetching Odoo stock movements:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/inventory/pickings - Fetch stock pickings
app.get('/odoo/inventory/pickings', checkOdooConfigured, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const pickings = await odooService.getStockPickings(limit);

    res.json({
      success: true,
      count: pickings.length,
      data: pickings
    });
  } catch (error) {
    console.error('Error fetching Odoo stock pickings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/inventory/summary - Inventory summary grouped by product or location
app.get('/odoo/inventory/summary', checkOdooConfigured, async (req, res) => {
  try {
    const groupBy = req.query.group_by || 'product';
    const limit = parseInt(req.query.limit) || 100;

    const summary = await odooService.getInventorySummary(groupBy, limit);

    res.json({
      success: true,
      grouped_by: groupBy,
      count: summary.length,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching Odoo inventory summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/dashboard - Quick dashboard metrics
app.get('/odoo/dashboard', checkOdooConfigured, async (req, res) => {
  try {
    const dashboard = await odooService.getDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching Odoo dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /odoo/model/:modelName - Generic access to any Odoo model
app.get('/odoo/model/:modelName', checkOdooConfigured, async (req, res) => {
  try {
    const { modelName } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    // Parse domain and fields from query params
    const domain = req.query.domain ? JSON.parse(req.query.domain) : [];
    const fields = req.query.fields ? req.query.fields.split(',') : [];

    const records = await odooService.getModel(modelName, domain, fields, limit);

    res.json({
      success: true,
      model: modelName,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error(`Error fetching Odoo model ${req.params.modelName}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard Proxy Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Erbil API: http://localhost:${PORT}/api/erbil`);
  console.log(`Duhok API: http://localhost:${PORT}/api/duhok`);
  console.log(`Bahrka API: http://localhost:${PORT}/api/bahrka`);
});
