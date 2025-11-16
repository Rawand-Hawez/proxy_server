require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const OdooService = require('./odooService');
const DatabaseService = require('./databaseService');
const CacheService = require('./cacheService');

const app = express();
const PORT = process.env.PORT || 3000;
const DOCS_PAGE_PATH = path.join(__dirname, 'public', 'docs.html');

// Configure CORS with optional allowed origins env
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '*')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Blocked CORS request from origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

async function initializeServices() {
  // Initialize Database Service
  let databaseService = null;
  try {
    databaseService = new DatabaseService(process.env.DATABASE_PATH || './data/proxy_server.db');
    await databaseService.initialize();
    console.log('Database service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database service:', error);
    databaseService = null;
  }

  // Initialize Cache Service
  let cacheService = null;
  if (databaseService) {
    try {
      cacheService = new CacheService(databaseService, {
        defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 3600,
        cachePrefix: process.env.CACHE_PREFIX || 'proxy_server:',
        fallbackToDB: process.env.CACHE_FALLBACK !== 'false'
      });
      await cacheService.initialize();
      console.log('Cache service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cache service:', error);
      cacheService = null;
    }
  }

  return { databaseService, cacheService };
}

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

// Initialize services
let databaseService = null;
let cacheService = null;

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

// Simple token-based authentication
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'demo-token-12345';

const authenticateToken = (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access token required',
      hint: 'Add Authorization: Bearer YOUR_TOKEN header to your requests'
    });
  }

  if (token !== ADMIN_TOKEN) {
    return res.status(403).json({
      success: false,
      error: 'Invalid access token',
      hint: 'Check your ADMIN_TOKEN environment variable'
    });
  }

  next();
};

// Apply authentication to admin endpoints
const requireAuth = [authenticateToken];

// Allow unauthenticated access to specific utility routes (health checks, token self-test)
const isPublicRoute = (req) => {
  const publicRoutes = [
    { path: '/', methods: ['GET', 'HEAD'] },
    { path: '/admin/token-validate', methods: ['GET'] }
  ];

  return publicRoutes.some(route => {
    if (req.path !== route.path) {
      return false;
    }
    return route.methods.includes(req.method);
  });
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Enable CORS before any authenticated routes
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});

// Apply rate limiting to core API groups (authentication is enforced globally below)
app.use('/api/', limiter);
app.use('/odoo/', limiter);
app.use('/extract/', limiter);

// Global authentication middleware to protect every endpoint
app.use((req, res, next) => {
  if (isPublicRoute(req)) {
    return next();
  }
  return authenticateToken(req, res, next);
});

app.use(express.json());

// Serve static files from public directory
app.use('/public', express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/', sendApiIndex);

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

const buildApiIndexResponse = () => ({
  status: 'ok',
  message: 'Dashboard Proxy Server is running',
  odoo_configured: !!odooService,
  database_configured: !!databaseService,
  cache_configured: !!cacheService,
  cache_redis_enabled: cacheService?.redisEnabled || false,
  documentation: {
    overview: '/',
    json_format: '/?format=json',
    climate_api: '/admin/climate',
    marketing_api: '/api/marketing/projects',
    mli_operations: '/admin/mli-ops'
  },
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
      monthly: '/extract/monthly?location={site}',
      quarterly: '/extract/quarterly?location={site}',
      dateRange: '/extract/date-range?location={site}'
    },
    climate: {
      list: '/api/climate/projects',
      stats: '/api/climate/stats',
      admin: '/admin/climate'
    },
    marketing: {
      projects: '/api/marketing/projects',
      metrics: '/api/marketing/:projectKey/metrics',
      data: '/api/marketing/:projectKey/data',
      stats: '/api/marketing/:projectKey/stats'
    },
    mliOperations: {
      programs: '/api/mli-ops/programs',
      admin: '/admin/mli-ops',
      docs: '/public/mli-ops-admin.html'
    },
    odoo: odooService ? {
      partners: '/odoo/partners',
      sale_orders: '/odoo/sale_orders',
      invoices: '/odoo/invoices',
      pos_orders: '/odoo/pos_orders',
      pos_payments: '/odoo/pos_payments',
      pos_summary: '/odoo/pos_summary',
      inventory: '/odoo/inventory/summary'
    } : 'Odoo not configured',
    admin: {
      status: '/admin/status',
      cache: '/admin/cache/stats',
      db: '/admin/db/custom-data',
      web_interface: '/admin'
    }
  }
});

function sendApiIndex(req, res) {
  const accepts = req.headers['accept'] || '';
  const acceptsHtml = accepts.includes('text/html');
  const wantsJson = req.query.format === 'json' || (!acceptsHtml && !req.query.format) || accepts.includes('application/json');

  if (wantsJson) {
    return res.json(buildApiIndexResponse());
  }

  return res.sendFile(DOCS_PAGE_PATH);
}

const formatMliOpsProgram = (program) => {
  if (!program) {
    return null;
  }

  const toNumber = (value) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  };

  const local = toNumber(program.local_trainer) || 0;
  const expat = toNumber(program.expat_trainer) || 0;
  const participants = toNumber(program.number_of_participants);
  const participantFee = toNumber(program.participant_fee);
  const computedRevenue = participants && participantFee ? participants * participantFee : null;
  const totalInput = program.total_revenue_input !== undefined && program.total_revenue_input !== null
    ? Number(program.total_revenue_input)
    : null;
  const programCost = toNumber(program.program_cost);

  let status = program.status;
  if (!status) {
    status = participants && participants > 0 ? 'completed' : 'planned';
  }

  return {
    ...program,
    status,
    trainers: local + expat,
    program_cost: programCost,
    computed_revenue: computedRevenue,
    final_revenue: totalInput !== null ? totalInput : computedRevenue,
    revenue_overridden: totalInput !== null && computedRevenue !== null && Math.abs(totalInput - computedRevenue) > 0.01
  };
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

app.get('/erbil-avenue/:resource', authenticateToken, async (req, res) => {
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

// ==========================================
// Climate Projects API Endpoints
// ==========================================

// Get all climate projects
app.get('/api/climate/projects', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const { limit, offset } = req.query;
    const projects = await databaseService.getAllClimateProjects(
      parseInt(limit) || 1000,
      parseInt(offset) || 0
    );

    res.json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching climate projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get climate project by ID
app.get('/api/climate/projects/:id', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const project = await databaseService.getClimateProjectById(parseInt(req.params.id));

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error fetching climate project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get climate project statistics
app.get('/api/climate/stats', async (_req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const stats = await databaseService.getClimateProjectStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching climate stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create climate project
app.post('/api/climate/projects', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const projectData = req.body;

    // Validate required fields
    const requiredFields = ['project', 'amount', 'unit', 'duration', 'status', 'location', 'partner'];
    const missingFields = requiredFields.filter(field => !projectData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const projectId = await databaseService.createClimateProject(projectData);

    res.status(201).json({
      success: true,
      message: 'Climate project created successfully',
      id: projectId
    });
  } catch (error) {
    console.error('Error creating climate project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update climate project
app.put('/api/climate/projects/:id', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const projectId = parseInt(req.params.id);
    const projectData = req.body;

    // Validate required fields
    const requiredFields = ['project', 'amount', 'unit', 'duration', 'status', 'location', 'partner'];
    const missingFields = requiredFields.filter(field => !projectData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const updated = await databaseService.updateClimateProject(projectId, projectData);

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.json({
      success: true,
      message: 'Climate project updated successfully'
    });
  } catch (error) {
    console.error('Error updating climate project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete climate project
app.delete('/api/climate/projects/:id', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const projectId = parseInt(req.params.id);
    const deleted = await databaseService.deleteClimateProject(projectId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.json({
      success: true,
      message: 'Climate project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting climate project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// Marketing Data API Endpoints
// ==========================================

// Get all marketing projects
app.get('/api/marketing/projects', async (_req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const projects = await databaseService.getAllMarketingProjects();
    res.json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching marketing projects:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create marketing project
app.post('/api/marketing/projects', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const { projectKey, projectName, description } = req.body;
    if (!projectKey || !projectName) {
      return res.status(400).json({
        success: false,
        error: 'projectKey and projectName are required'
      });
    }

    const projectId = await databaseService.createMarketingProject({
      projectKey,
      projectName,
      description
    });

    res.status(201).json({
      success: true,
      message: 'Marketing project created successfully',
      id: projectId
    });
  } catch (error) {
    console.error('Error creating marketing project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get marketing project by key
app.get('/api/marketing/projects/:projectKey', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const project = await databaseService.getMarketingProjectByKey(req.params.projectKey);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    res.json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error fetching marketing project:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get metrics for a project
app.get('/api/marketing/:projectKey/metrics', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const project = await databaseService.getMarketingProjectByKey(req.params.projectKey);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const metrics = await databaseService.getMarketingMetricsByProject(project.id);
    res.json({
      success: true,
      count: metrics.length,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching marketing metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create metric for a project
app.post('/api/marketing/:projectKey/metrics', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const project = await databaseService.getMarketingProjectByKey(req.params.projectKey);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const { metricKey, metricLabel, category } = req.body;
    if (!metricKey || !metricLabel) {
      return res.status(400).json({
        success: false,
        error: 'metricKey and metricLabel are required'
      });
    }

    const metricId = await databaseService.createMarketingMetric({
      projectId: project.id,
      metricKey,
      metricLabel,
      category
    });

    res.status(201).json({
      success: true,
      message: 'Metric created successfully',
      id: metricId
    });
  } catch (error) {
    console.error('Error creating marketing metric:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get time-series data for a project
app.get('/api/marketing/:projectKey/data', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const project = await databaseService.getMarketingProjectByKey(req.params.projectKey);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const { from, to, grouped } = req.query;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'from and to date parameters are required (YYYY-MM-DD)'
      });
    }

    let data;
    if (grouped === 'true') {
      data = await databaseService.getMarketingDataGroupedByMetric(project.id, from, to);
    } else {
      data = await databaseService.getMarketingData(project.id, from, to);
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching marketing data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get statistics for a project
app.get('/api/marketing/:projectKey/stats', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const project = await databaseService.getMarketingProjectByKey(req.params.projectKey);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'from and to date parameters are required (YYYY-MM-DD)'
      });
    }

    const stats = await databaseService.getMarketingStats(project.id, from, to);
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching marketing stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk upload marketing data
app.post('/api/marketing/:projectKey/data/bulk', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const project = await databaseService.getMarketingProjectByKey(req.params.projectKey);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const { data } = req.body;
    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'data array is required and must not be empty'
      });
    }

    // Validate and transform data
    const dataPoints = [];
    for (const item of data) {
      if (!item.metricKey || !item.date || item.value === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Each data item must have metricKey, date, and value'
        });
      }

      // Get metric ID
      const metric = await databaseService.getMarketingMetricByKey(project.id, item.metricKey);
      if (!metric) {
        return res.status(400).json({
          success: false,
          error: `Metric not found: ${item.metricKey}`
        });
      }

      dataPoints.push({
        projectId: project.id,
        metricId: metric.id,
        date: item.date,
        value: parseFloat(item.value)
      });
    }

    const count = await databaseService.bulkUpsertMarketingData(dataPoints);

    res.json({
      success: true,
      message: `Successfully uploaded ${count} data points`,
      count
    });
  } catch (error) {
    console.error('Error bulk uploading marketing data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete marketing data point
app.delete('/api/marketing/:projectKey/data', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const project = await databaseService.getMarketingProjectByKey(req.params.projectKey);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const { metricKey, date } = req.query;
    if (!metricKey || !date) {
      return res.status(400).json({
        success: false,
        error: 'metricKey and date query parameters are required'
      });
    }

    const metric = await databaseService.getMarketingMetricByKey(project.id, metricKey);
    if (!metric) {
      return res.status(404).json({
        success: false,
        error: 'Metric not found'
      });
    }

    const deleted = await databaseService.deleteMarketingData(project.id, metric.id, date);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Data point not found'
      });
    }

    res.json({
      success: true,
      message: 'Data point deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting marketing data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// MLI OPERATIONS API ENDPOINTS
// ==========================================

app.get('/api/mli-ops/programs', async (_req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ success: false, error: 'Database service not available' });
    }

    const programs = await databaseService.getAllMliOpsPrograms();
    res.json({
      success: true,
      count: programs.length,
      data: programs.map(formatMliOpsProgram)
    });
  } catch (error) {
    console.error('Error fetching MLI operations programs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/mli-ops/programs', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ success: false, error: 'Database service not available' });
    }

    const payload = req.body || {};
    if (!payload.program || !payload.program.trim()) {
      return res.status(400).json({ success: false, error: 'Program name is required' });
    }

    const programId = await databaseService.upsertMliOpsProgram(payload);
    const savedProgram = await databaseService.getMliOpsProgramById(programId);

    res.status(201).json({
      success: true,
      data: formatMliOpsProgram(savedProgram)
    });
  } catch (error) {
    console.error('Error saving MLI operations program:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/mli-ops/programs/:id', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ success: false, error: 'Database service not available' });
    }

    const programId = parseInt(req.params.id, 10);
    if (Number.isNaN(programId)) {
      return res.status(400).json({ success: false, error: 'Invalid program ID' });
    }

    const existing = await databaseService.getMliOpsProgramById(programId);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    const payload = {
      ...existing,
      ...req.body,
      id: programId,
      program: (req.body.program || existing.program || '').trim()
    };

    if (!payload.program) {
      return res.status(400).json({ success: false, error: 'Program name is required' });
    }

    await databaseService.upsertMliOpsProgram(payload);
    const updated = await databaseService.getMliOpsProgramById(programId);

    res.json({
      success: true,
      data: formatMliOpsProgram(updated)
    });
  } catch (error) {
    console.error('Error updating MLI operations program:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/mli-ops/programs/:id', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ success: false, error: 'Database service not available' });
    }

    const programId = parseInt(req.params.id, 10);
    if (Number.isNaN(programId)) {
      return res.status(400).json({ success: false, error: 'Invalid program ID' });
    }

    const deleted = await databaseService.deleteMliOpsProgram(programId);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Program not found' });
    }

    res.json({ success: true, message: 'Program deleted successfully' });
  } catch (error) {
    console.error('Error deleting MLI operations program:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/mli-ops/programs', async (_req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ success: false, error: 'Database service not available' });
    }

    await databaseService.clearMliOpsPrograms();
    res.json({ success: true, message: 'All programs cleared' });
  } catch (error) {
    console.error('Error clearing MLI operations programs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// TopCare API Proxy Endpoints
// ==========================================

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
    
    // Generate cache key
    const cacheKey = cacheService?.generateCacheKey('/odoo/partners', { limit });
    
    // Try to get from cache
    if (cacheService) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          count: cached.length,
          data: cached
        });
      }
    }
    
    // Fetch from Odoo
    const partners = await odooService.getPartners(limit);
    
    // Store in cache (1 hour TTL)
    if (cacheService) {
      await cacheService.set(cacheKey, partners, 3600);
    }

    res.json({
      success: true,
      cached: false,
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

    // Generate cache key
    const cacheKey = cacheService?.generateCacheKey('/odoo/sale_orders', { limit, start, end });
    
    // Try to get from cache
    if (cacheService) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          count: cached.length,
          ...(start && end && { date_range: { start, end } }),
          data: cached
        });
      }
    }

    // Fetch from Odoo
    const orders = await odooService.getSaleOrders(limit, start, end);
    
    // Store in cache (30 minutes TTL for time-sensitive data)
    if (cacheService) {
      await cacheService.set(cacheKey, orders, 1800);
    }

    res.json({
      success: true,
      cached: false,
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

    // Generate cache key
    const cacheKey = cacheService?.generateCacheKey('/odoo/invoices', { limit, start, end });
    
    // Try to get from cache
    if (cacheService) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          count: cached.length,
          ...(start && end && { date_range: { start, end } }),
          data: cached
        });
      }
    }

    // Fetch from Odoo
    const invoices = await odooService.getInvoices(limit, start, end);
    
    // Store in cache (30 minutes TTL)
    if (cacheService) {
      await cacheService.set(cacheKey, invoices, 1800);
    }

    res.json({
      success: true,
      cached: false,
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

    // Generate cache key
    const cacheKey = cacheService?.generateCacheKey('/odoo/pos_orders', { limit, start, end });
    
    // Try to get from cache
    if (cacheService) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          count: cached.length,
          ...(start && end && { date_range: { start, end } }),
          data: cached
        });
      }
    }

    // Fetch from Odoo
    const orders = await odooService.getPosOrders(limit, start, end);
    
    // Store in cache (15 minutes TTL for POS data)
    if (cacheService) {
      await cacheService.set(cacheKey, orders, 900);
    }

    res.json({
      success: true,
      cached: false,
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

    // Generate cache key
    const cacheKey = cacheService?.generateCacheKey('/odoo/pos_payments', { limit, start, end });
    
    // Try to get from cache
    if (cacheService) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          count: cached.length,
          ...(start && end && { date_range: { start, end } }),
          data: cached
        });
      }
    }

    // Fetch from Odoo
    const payments = await odooService.getPosPayments(limit, start, end);
    
    // Store in cache (15 minutes TTL)
    if (cacheService) {
      await cacheService.set(cacheKey, payments, 900);
    }

    res.json({
      success: true,
      cached: false,
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
    
    // Generate cache key
    const cacheKey = cacheService?.generateCacheKey('/odoo/pos_summary', { start, end });
    
    // Try to get from cache
    if (cacheService) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({
          ...cached,
          cached: true
        });
      }
    }
    
    // Fetch from Odoo
    const summary = await odooService.getPosSummary(start, end);
    
    // Store in cache (10 minutes TTL for summary data)
    if (cacheService) {
      await cacheService.set(cacheKey, summary, 600);
    }

    res.json({
      ...summary,
      cached: false
    });
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
    
    // Generate cache key
    const cacheKey = cacheService?.generateCacheKey('/odoo/inventory/stock_levels', { limit });
    
    // Try to get from cache
    if (cacheService) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          cached: true,
          count: cached.length,
          data: cached
        });
      }
    }
    
    // Fetch from Odoo
    const stockLevels = await odooService.getStockLevels(limit);
    
    // Store in cache (5 minutes TTL for inventory data)
    if (cacheService) {
      await cacheService.set(cacheKey, stockLevels, 300);
    }

    res.json({
      success: true,
      cached: false,
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
    // Generate cache key
    const cacheKey = cacheService?.generateCacheKey('/odoo/dashboard', {});
    
    // Try to get from cache
    if (cacheService) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json({
          ...cached,
          cached: true
        });
      }
    }
    
    // Fetch from Odoo
    const dashboard = await odooService.getDashboard();
    
    // Store in cache (5 minutes TTL for dashboard)
    if (cacheService) {
      await cacheService.set(cacheKey, dashboard, 300);
    }
    
    res.json({
      ...dashboard,
      cached: false
    });
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

// ============================================
// ADMIN AND MONITORING ENDPOINTS
// ============================================

// Token validation endpoint (no auth required)
app.get('/admin/token-validate', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  res.json({
    valid: token === ADMIN_TOKEN,
    token_provided: !!token,
    message: token === ADMIN_TOKEN ? 'Token is valid' : 'Token is invalid or missing'
  });
});

// Get admin token info (requires auth)
app.get('/admin/token-info', requireAuth, (req, res) => {
  res.json({
    success: true,
    token_length: ADMIN_TOKEN.length,
    token_preview: ADMIN_TOKEN.substring(0, 4) + '****',
    environment_variable: 'ADMIN_TOKEN',
    header_format: 'Authorization: Bearer ' + ADMIN_TOKEN,
    note: 'Change ADMIN_TOKEN in production for security'
  });
});

// System status endpoint (requires auth)

// ============================================
// ADMIN AND MONITORING ENDPOINTS
// ============================================

// System status endpoint
app.get('/admin/status', async (req, res) => {
  try {
    const status = {
      server: {
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
        node_version: process.version
      },
      odoo: {
        configured: !!odooService,
        authenticated: odooService?.uid ? true : false,
        user_id: odooService?.uid || null
      },
      database: {
        configured: !!databaseService,
        initialized: databaseService?.initialized || false,
        stats: databaseService ? await databaseService.getDatabaseStats() : null
      },
      cache: {
        configured: !!cacheService,
        redis_enabled: cacheService?.redisEnabled || false,
        stats: cacheService ? await cacheService.getStats() : null,
        health: cacheService ? await cacheService.healthCheck() : null
      }
    };

    res.json(status);
  } catch (error) {
    console.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Database management endpoints
app.get('/admin/db/custom-data', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const { table, limit, offset } = req.query;
    const data = await databaseService.getCustomRecords(table || 'default',
      parseInt(limit) || 50, parseInt(offset) || 0);

    res.json({
      success: true,
      table: table || 'default',
      count: data.length,
      data
    });
  } catch (error) {
    console.error('Error fetching custom data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/admin/db/custom-data', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const { table, record } = req.body;
    if (!table || !record) {
      return res.status(400).json({ error: 'Table and record are required' });
    }

    const id = await databaseService.createCustomRecord(table, record);
    res.json({
      success: true,
      id,
      message: 'Record created successfully'
    });
  } catch (error) {
    console.error('Error creating custom data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.put('/admin/db/custom-data/:id', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const { record } = req.body;
    if (!record) {
      return res.status(400).json({ error: 'Record data is required' });
    }

    const updated = await databaseService.updateCustomRecord(req.params.id, record);
    res.json({
      success: updated,
      message: updated ? 'Record updated successfully' : 'Record not found'
    });
  } catch (error) {
    console.error('Error updating custom data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/admin/db/custom-data/:id', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const deleted = await databaseService.deleteCustomRecord(req.params.id);
    res.json({
      success: deleted,
      message: deleted ? 'Record deleted successfully' : 'Record not found'
    });
  } catch (error) {
    console.error('Error deleting custom data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Configuration management
app.get('/admin/db/config', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const configs = await databaseService.getAllConfigs();
    res.json({
      success: true,
      count: configs.length,
      data: configs
    });
  } catch (error) {
    console.error('Error fetching configs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/admin/db/config', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'Key and value are required' });
    }

    const success = await databaseService.setConfig(key, value, description || '');
    res.json({
      success,
      message: success ? 'Configuration updated successfully' : 'Failed to update configuration'
    });
  } catch (error) {
    console.error('Error setting config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cache management endpoints
app.get('/admin/cache/stats', async (req, res) => {
  try {
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not available' });
    }

    const stats = await cacheService.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/admin/cache/clear', async (req, res) => {
  try {
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not available' });
    }

    const { pattern } = req.body;
    const cleared = await cacheService.clearPattern(pattern || '*');
    
    res.json({
      success: true,
      cleared_entries: cleared,
      message: `Cleared ${cleared} cache entries`
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/admin/cache/health', async (req, res) => {
  try {
    if (!cacheService) {
      return res.status(503).json({ error: 'Cache service not available' });
    }

    const health = await cacheService.healthCheck();
    res.json({
      success: true,
      health
    });
  } catch (error) {
    console.error('Error getting cache health:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API Logs endpoint
app.get('/admin/logs', async (req, res) => {
  try {
    if (!databaseService) {
      return res.status(503).json({ error: 'Database service not available' });
    }

    const { limit, offset } = req.query;
    const logs = await databaseService.getApiLogs(
      parseInt(limit) || 100,
      parseInt(offset) || 0
    );

    res.json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Climate projects admin interface
app.get('/admin/climate', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'climate-admin.html'));
});

// MLI operations admin interface
app.get('/admin/mli-ops', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'mli-ops-admin.html'));
});

// Admin web interface
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Proxy Server - Admin</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .btn { background: #3498db; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 5px; }
            .btn:hover { background: #2980b9; }
            .btn-danger { background: #e74c3c; }
            .btn-danger:hover { background: #c0392b; }
            .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
            .status-ok { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .status-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; }
            .json { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-family: monospace; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Dashboard Proxy Server - Admin Panel</h1>
                <p>Manage database, cache, and monitor system performance</p>
            </div>

            <div class="grid">
                <div class="card">
                    <h3>System Status</h3>
                    <div id="system-status">
                        <button class="btn" onclick="loadStatus()">Refresh Status</button>
                        <div id="status-content"></div>
                    </div>
                </div>

                <div class="card">
                    <h3>Cache Management</h3>
                    <button class="btn" onclick="loadCacheStats()">Cache Stats</button>
                    <button class="btn" onclick="loadCacheHealth()">Health Check</button>
                    <button class="btn btn-danger" onclick="clearCache()">Clear All Cache</button>
                    <div id="cache-content"></div>
                </div>

                <div class="card">
                    <h3>Database Management</h3>
                    <button class="btn" onclick="loadCustomData()">View Custom Data</button>
                    <button class="btn" onclick="loadConfigs()">View Configs</button>
                    <div id="database-content"></div>
                </div>

                <div class="card">
                    <h3>API Logs</h3>
                    <button class="btn" onclick="loadLogs()">View Logs</button>
                    <div id="logs-content"></div>
                </div>
            </div>
        </div>

        <script>
            async function loadStatus() {
                try {
                    const response = await fetch('/admin/status');
                    const data = await response.json();
                    document.getElementById('status-content').innerHTML =
                        '<pre class="json">' + JSON.stringify(data, null, 2) + '</pre>';
                } catch (error) {
                    document.getElementById('status-content').innerHTML =
                        '<div class="status status-error">Error loading status: ' + error.message + '</div>';
                }
            }

            async function loadCacheStats() {
                try {
                    const response = await fetch('/admin/cache/stats');
                    const data = await response.json();
                    document.getElementById('cache-content').innerHTML =
                        '<pre class="json">' + JSON.stringify(data, null, 2) + '</pre>';
                } catch (error) {
                    document.getElementById('cache-content').innerHTML =
                        '<div class="status status-error">Error loading cache stats: ' + error.message + '</div>';
                }
            }

            async function loadCacheHealth() {
                try {
                    const response = await fetch('/admin/cache/health');
                    const data = await response.json();
                    const statusClass = data.health.status === 'healthy' ? 'status-ok' : 'status-error';
                    document.getElementById('cache-content').innerHTML =
                        '<div class="status ' + statusClass + '">' +
                        '<pre class="json">' + JSON.stringify(data, null, 2) + '</pre></div>';
                } catch (error) {
                    document.getElementById('cache-content').innerHTML =
                        '<div class="status status-error">Error loading cache health: ' + error.message + '</div>';
                }
            }

            async function clearCache() {
                if (confirm('Are you sure you want to clear all cache entries?')) {
                    try {
                        const response = await fetch('/admin/cache/clear', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ pattern: '*' })
                        });
                        const data = await response.json();
                        alert(data.message || 'Cache cleared');
                        loadCacheStats();
                    } catch (error) {
                        alert('Error clearing cache: ' + error.message);
                    }
                }
            }

            async function loadCustomData() {
                try {
                    const response = await fetch('/admin/db/custom-data');
                    const data = await response.json();
                    document.getElementById('database-content').innerHTML =
                        '<pre class="json">' + JSON.stringify(data, null, 2) + '</pre>';
                } catch (error) {
                    document.getElementById('database-content').innerHTML =
                        '<div class="status status-error">Error loading custom data: ' + error.message + '</div>';
                }
            }

            async function loadConfigs() {
                try {
                    const response = await fetch('/admin/db/config');
                    const data = await response.json();
                    document.getElementById('database-content').innerHTML =
                        '<pre class="json">' + JSON.stringify(data, null, 2) + '</pre>';
                } catch (error) {
                    document.getElementById('database-content').innerHTML =
                        '<div class="status status-error">Error loading configs: ' + error.message + '</div>';
                }
            }

            async function loadLogs() {
                try {
                    const response = await fetch('/admin/logs?limit=50');
                    const data = await response.json();
                    document.getElementById('logs-content').innerHTML =
                        '<pre class="json">' + JSON.stringify(data, null, 2) + '</pre>';
                } catch (error) {
                    document.getElementById('logs-content').innerHTML =
                        '<div class="status status-error">Error loading logs: ' + error.message + '</div>';
                }
            }

            // Load initial data
            loadStatus();
        </script>
    </body>
    </html>
  `);
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize database and cache services
    const services = await initializeServices();
    databaseService = services.databaseService;
    cacheService = services.cacheService;
    
    // Update health check endpoint to include service status
    app.get('/', sendApiIndex);

    // Start server
    app.listen(PORT, () => {
      console.log(`Dashboard Proxy Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/`);
      console.log(`Erbil API: http://localhost:${PORT}/api/erbil`);
      console.log(`Duhok API: http://localhost:${PORT}/api/duhok`);
      console.log(`Bahrka API: http://localhost:${PORT}/api/bahrka`);
      console.log(`Admin Interface: http://localhost:${PORT}/admin`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
