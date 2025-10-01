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

// Generic proxy endpoint
app.get('/api/:location', async (req, res) => {
  const { location } = req.params;
  const config = TOPCARE_APIS[location];

  if (!config) {
    return res.status(404).json({ error: 'Location not found' });
  }

  try {
    // Build the full URL with query parameters
    const queryParams = new URLSearchParams(req.query).toString();
    const fullUrl = `${config.url}${queryParams ? '?' + queryParams : ''}`;

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

app.listen(PORT, () => {
  console.log(`Dashboard Proxy Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`Erbil API: http://localhost:${PORT}/api/erbil`);
  console.log(`Duhok API: http://localhost:${PORT}/api/duhok`);
  console.log(`Bahrka API: http://localhost:${PORT}/api/bahrka`);
});
