# Dashboard Proxy Server - Enhanced with Caching & Database

A powerful CORS proxy server with built-in Redis caching, SQLite database management, and comprehensive admin interface for dashboard APIs.

## 🚀 New Features Added

### ✅ Redis Caching
- **Redis Integration**: High-performance in-memory caching
- **Database Fallback**: Automatic fallback to SQLite when Redis unavailable
- **Smart Cache Strategies**: Different TTL settings for different endpoints
- **Cache Management**: Real-time cache statistics and health monitoring

### ✅ SQLite Database
- **Local Data Storage**: Persistent storage for custom data and configuration
- **API Response Caching**: Cache API responses with expiration
- **Comprehensive Logging**: Track all API calls with performance metrics
- **Configuration Management**: Store and manage application settings

### ✅ Admin Web Interface
- **System Dashboard**: Real-time monitoring of all services
- **Cache Management**: View stats, health, and clear cache entries
- **Database Management**: Browse and edit custom data records
- **Configuration Editor**: Manage application settings through web UI
- **API Logs Viewer**: Monitor request patterns and performance

### ✅ Enhanced Security
- **Rate Limiting**: Protect against API abuse
- **Security Headers**: Helmet.js integration for HTTP security
- **Input Validation**: Comprehensive validation for all endpoints
- **Error Handling**: Consistent error responses across all endpoints

## 📋 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Start Server
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### 4. Access Admin Interface
```
http://localhost:3000/admin
```

## 🔧 Configuration Options

### Required Environment Variables
```bash
# Server port
PORT=3000
```

### Optional Redis Configuration
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password
REDIS_DB=0
```

### Optional Odoo Integration
```bash
ODOO_URL=https://your-odoo-instance.odoo.com
ODOO_DB=your_database_name
ODOO_USER=your_email@example.com
ODOO_PASSWORD=your_api_key
```

### Cache Settings
```bash
CACHE_DEFAULT_TTL=3600      # Default cache duration (seconds)
CACHE_PREFIX=proxy_server:   # Cache key prefix
CACHE_FALLBACK=true          # Enable database fallback
```

### Security Settings
```bash
ADMIN_TOKEN=your-secure-token-here  # Token for API authentication
RATE_LIMIT_WINDOW=900000            # Rate limit window (milliseconds)
RATE_LIMIT_MAX=100                  # Max requests per window
```

### Authentication
All API endpoints require token-based authentication. Include the token in the Authorization header:

```bash
# Example with curl
curl -H "Authorization: Bearer your-secure-token-here" \
     http://localhost:3000/api/erbil

# Or in JavaScript
fetch('/api/erbil', {
  headers: {
    'Authorization': 'Bearer your-secure-token-here'
  }
})
```

Default token: `demo-token-12345` (change in production!)

## 🏗️ Architecture Overview

```
┌─────────────────┐
│   Dashboard     │
│   Frontend      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│  Proxy Server   │────│    Redis     │    │   SQLite DB     │
│  (Express.js)   │    │   (Cache)    │    │ (Persistence)   │
└─────────┬───────┘    └──────────────┘    └─────────┬───────┘
          │                                              │
          ▼                                              ▼
┌─────────────────┐                            ┌─────────────────┐
│  TopCare APIs   │                            │ Admin Interface │
│  Odoo ERP       │                            │  (/admin)       │
│  Erbil Avenue   │                            └─────────────────┘
└─────────────────┘
```

## 📊 Admin Interface Features

### System Status Dashboard
- Real-time server uptime and memory usage
- Odoo service connection status
- Database and cache health indicators
- Service configuration overview

### Cache Management
- View Redis/SQLite cache statistics
- Monitor cache hit/miss rates
- Health checks for both cache backends
- Clear cache by pattern or globally

### Database Management
- Browse custom data records
- Create, read, update, delete operations
- Configuration key-value store
- API call logs with performance metrics

### API Monitoring
- Recent API requests and responses
- Performance metrics and response times
- Error tracking and debugging information
- System health monitoring

## 🔌 API Endpoints

### Core Proxy Endpoints
- `GET /api/erbil` - TopCare Erbil API proxy
- `GET /api/duhok` - TopCare Duhok API proxy  
- `GET /api/bahrka` - TopCare Bahrka API proxy
- `GET /erbil-avenue/:resource` - Erbil Avenue API proxy

### Data Extraction Endpoints
- `GET /extract/monthly` - Extract monthly data
- `GET /extract/quarterly` - Extract quarterly data
- `GET /extract/date-range` - Extract custom date range data

### Odoo ERP Integration
- `GET /odoo/partners` - Customer partners
- `GET /odoo/sale_orders` - Sale orders with line items
- `GET /odoo/invoices` - Invoice records
- `GET /odoo/pos_orders` - Point of sale orders
- `GET /odoo/pos_summary` - POS summary metrics
- `GET /odoo/inventory/*` - Inventory management endpoints

### Admin & Management Endpoints
- `GET /admin` - Web-based admin interface
- `GET /admin/status` - System status and health
- `GET /admin/cache/stats` - Cache performance statistics
- `POST /admin/cache/clear` - Clear cache entries
- `GET /admin/db/custom-data` - Database records management
- `GET /admin/db/config` - Configuration management
- `GET /admin/logs` - API call logs and monitoring

## 💾 Database Schema

### Core Tables
- **api_cache** - Cached API responses with TTL
- **custom_data** - User-defined data records
- **api_logs** - API request/response logging
- **app_config** - Application configuration storage
- **user_sessions** - Web interface session management
- **sync_logs** - Data synchronization tracking

## 🚀 Performance Features

### Intelligent Caching
- **Redis Primary**: Fast in-memory caching
- **SQLite Fallback**: Persistent cache when Redis unavailable
- **Smart TTL**: Different cache durations per endpoint type
- **Cache Warming**: Automatic cache population for frequently accessed data

### Monitoring & Analytics
- **Real-time Metrics**: Response times, cache hit rates, error rates
- **Historical Data**: Track performance over time
- **Alert System**: Health checks and status monitoring
- **Usage Analytics**: API call patterns and popular endpoints

### Security Enhancements
- **Rate Limiting**: Prevent API abuse and DoS attacks
- **Input Validation**: Comprehensive parameter validation
- **Error Sanitization**: Secure error responses
- **Security Headers**: Built-in HTTP security with Helmet

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Run database service tests
node test-database.js

# Test Redis connection (if configured)
redis-cli ping
```

### Testing Endpoints
```bash
# Health check
curl http://localhost:3000/

# System status
curl http://localhost:3000/admin/status

# Cache statistics
curl http://localhost:3000/admin/cache/stats

# Database records
curl http://localhost:3000/admin/db/custom-data
```

### Docker Deployment
```bash
# Build image
docker build -t proxy-server .

# Run with environment variables
docker run -p 3000:3000 \
  -e PORT=3000 \
  -e REDIS_HOST=redis-server \
  -e DATABASE_PATH=/data/proxy_server.db \
  proxy-server
```

## 📈 Monitoring & Maintenance

### Health Checks
- **System Health**: `GET /admin/status`
- **Cache Health**: `GET /admin/cache/health`
- **Database Health**: Automatically checked on startup

### Maintenance Tasks
- **Cache Cleanup**: Automatic cleanup of expired entries
- **Log Rotation**: Configurable log retention policies
- **Database Optimization**: Automatic index optimization

### Performance Tuning
- **Cache Tuning**: Adjust TTL values per endpoint
- **Rate Limiting**: Configure based on usage patterns
- **Database Tuning**: SQLite optimization for your workload

## 🔒 Security Considerations

### API Security
- Rate limiting prevents abuse
- Input validation on all endpoints
- Secure error responses
- CORS properly configured

### Admin Interface Security
- Session-based authentication (extensible)
- CSRF protection via same-origin policy
- Input sanitization for all operations
- Audit logging for admin actions

## 📚 Additional Resources

### Documentation
- `DEVELOPER_GUIDE.md` - Technical implementation details
- `README.md` - Basic functionality (this file)
- `odooService.js` - Odoo integration module
- `cacheService.js` - Caching implementation
- `databaseService.js` - Database operations

### Support
- Check system status at `/admin/status`
- Review logs at `/admin/logs`
- Monitor cache performance at `/admin/cache/stats`
- View database operations at `/admin/db/custom-data`

---

**Dashboard Proxy Server** - Enhanced with caching, database, and comprehensive admin interface for optimal API performance and management.
