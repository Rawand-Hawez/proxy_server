const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Dashboard Proxy Server is running',
    endpoints: {
      erbil: '/api/erbil',
      duhok: '/api/duhok',
      bahrka: '/api/bahrka'
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
