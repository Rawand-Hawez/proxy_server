# Odoo ERP Bridge Server

This repository hosts a lightweight Flask service that exposes selected Odoo data over RESTful endpoints. It acts as a bridge between front-end clients and an Odoo instance by wrapping the XML-RPC API with JSON responses and simple query parameters.

## Features
- Authenticates against Odoo using the XML-RPC API.
- Provides curated endpoints for core business objects (partners, sales, invoices, POS, stock).
- Enables limited ad-hoc access to any model through the dynamic `/api/<model>` route.
- Supports cross-origin requests with Flask-CORS, making it easy to consume from web dashboards.

## Prerequisites
- Python 3.9+ (recommended 3.10 or newer).
- Access to an Odoo instance with an active database and API credentials.
- `pip` for dependency installation.

## Environment Variables
Create a `.env` file at the repository root with the following keys:

```
ODOO_URL=https://your-odoo-host
ODOO_DB=your_db_name
ODOO_USER=api_user@example.com
ODOO_PASSWORD=your_password_or_api_key
```

> **Security note:** Never commit real credentials to version control. Consider using scoped API keys/users with the minimum required permissions.

## Installation
1. (Optional) Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install flask flask-cors python-dotenv certifi
   ```

## Running the Server
1. Ensure the `.env` file is populated with valid Odoo credentials.
2. Start the Flask application:
   ```bash
   python main.py
   ```
3. The server listens on `http://0.0.0.0:5050` by default. A basic health check is available at `/`:
   ```bash
   curl http://127.0.0.1:5050/
   ```

## Available Endpoints

| Route | Description | Key Query Parameters |
| --- | --- | --- |
| `/` | Health check; confirms the bridge is running. | – |
| `/api/partners` | Fetches customer-facing partners (customer rank > 0). | – |
| `/api/sale_orders` | Returns recent sale orders in states draft/sent/sale/done. | – |
| `/api/invoices` | Lists outgoing invoices (`move_type=out_invoice`). | – |
| `/api/pos_orders` | Lists POS orders ordered by date. | `limit` (default 10, max 5000) |
| `/api/pos_payments` | Retrieves POS payment records. | – |
| `/api/pos_summary` | Aggregates totals for paid POS orders. | – |
| `/api/pos_order_items` | Fetches line items for a given POS order. | `order_id` (required), `limit` |
| `/api/pos_orders/<order_id>/items` | Returns a POS order with its line items. | `limit` |
| `/api/inventory/stock_levels` | Reads stock quants or falls back to product availability. | `limit` |
| `/api/inventory/movements` | Lists recent completed stock moves. | `limit` |
| `/api/inventory/pickings` | Retrieves stock transfer records. | `limit` |
| `/api/inventory/summary` | Summarises inventory by product (default) or location. | `group_by` (`product`/`location`), `limit` |
| `/api/dashboard` | Quick dashboard metrics (counts & revenue). | – |
| `/api/<model>` | Generic bridge to any Odoo model using `search_read`. | `fields`, `domain`, `limit` |

### Example Request
Retrieve the five most recent POS orders:
```bash
curl "http://127.0.0.1:5050/api/pos_orders?limit=5"
```

### Error Handling
- All endpoints return JSON following `{ "success": <bool>, ... }`.
- Failures include an `"error"` field with the exception message and respond with HTTP 500 or 4xx when applicable.
- Server-side exceptions are logged to the console with stack traces for easier debugging.

## Deployment Notes
- Configure a production-ready WSGI server (e.g., Gunicorn or uWSGI) and proxy (e.g., Nginx) for live environments.
- Disable Flask `debug` mode outside development.
- Secure TLS at the proxy level; outgoing XML-RPC calls already enforce SSL certificate validation via `certifi`.
- Review rate limits and add caching or pagination before exposing endpoints to public clients.

## Extending the Bridge
- Add new endpoints by composing domains/fields with `models.execute_kw`.
- Wrap complex workflows into dedicated service functions to keep route handlers slim.
- Consider introducing input validation, authentication, and request logging if the bridge is exposed beyond trusted networks.

