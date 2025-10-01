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

None required - API keys are embedded in the server code.

## Endpoints

- `GET /` - Health check
- `GET /api/erbil?endpoint=...&from=...&to=...` - Proxy for Erbil API (TopCare)
- `GET /api/duhok?endpoint=...&from=...&to=...` - Proxy for Duhok API (TopCare)
- `GET /api/bahrka?endpoint=...&from=...&to=...` - Proxy for Bahrka API (TopCare)
- `GET /erbil-avenue/dashboard` - Supabase `v_dashboard` dataset for Erbil Avenue
- `GET /erbil-avenue/history` - Supabase `v_dashboard_history` dataset for Erbil Avenue
- `GET /erbil-avenue/expected-rent` - Supabase `v_monthly_rent_breakdown` dataset for Erbil Avenue

## Local Development

```bash
npm install
npm start
```

Or with auto-reload:

```bash
npm run dev
```

## Usage from Dashboard

Once deployed, update the dashboard's `app.js` to use the proxy URLs:

```javascript
const API_CONFIG = {
    topcare: {
        erbil: {
            url: 'https://your-proxy-domain.com/api/erbil',
            apiKey: '...'
        },
        duhok: {
            url: 'https://your-proxy-domain.com/api/duhok',
            apiKey: '...'
        },
        bahrka: {
            url: 'https://your-proxy-domain.com/api/bahrka',
            apiKey: '...'
        }
    }
};
```
