const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

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
      }
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

app.listen(PORT, () => {
  console.log(`Dashboard Proxy Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Erbil API: http://localhost:${PORT}/api/erbil`);
  console.log(`Duhok API: http://localhost:${PORT}/api/duhok`);
  console.log(`Bahrka API: http://localhost:${PORT}/api/bahrka`);
});
