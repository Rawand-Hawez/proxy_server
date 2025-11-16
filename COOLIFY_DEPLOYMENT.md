# Coolify Deployment Guide

This guide will help you deploy the Dashboard Proxy Server to Coolify with Redis caching.

## Prerequisites

- Coolify instance running
- Git repository with your code
- Odoo credentials

## Deployment Steps

### 1. Create a New Application in Coolify

1. Log in to your Coolify dashboard
2. Click **"+ New Resource"**
3. Select **"Docker Compose"**
4. Choose your Git repository or upload the project

### 2. Configure Environment Variables

In Coolify, go to your application's **Environment Variables** section and add:

#### Required Variables:
```env
# Odoo Configuration
ODOO_URL=https://your-odoo-instance.odoo.com
ODOO_DB=your_database_name
ODOO_USER=your_odoo_user@example.com
ODOO_PASSWORD=your_odoo_password

# Security
ADMIN_TOKEN=your_secure_random_token_here

# Server Configuration
PORT=3000
NODE_ENV=production
```

#### Optional Variables (with defaults):
```env
# Redis Configuration (automatically set by docker-compose)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0

# Cache Configuration
CACHE_DEFAULT_TTL=3600
CACHE_PREFIX=proxy_server:
CACHE_FALLBACK=true

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Database
DATABASE_PATH=/app/data/proxy_server.db
```

### 3. Configure Volumes (Automatic)

The `docker-compose.yml` automatically creates persistent volumes for:
- **app-data**: SQLite database storage (persists between deployments)
- **redis-data**: Redis persistence

**Database Initialization**: On first deployment, the application will automatically:
- Initialize the SQLite database with the required schema
- Import climate project data from `docs/data/climate/climate.js`
- Import MLI marketing data from `docs/data/mli/mli.js`
- Skip initialization if data already exists (safe for redeployments)
### 4. Deploy

1. Click **"Deploy"** in Coolify
2. Wait for the build and deployment to complete
3. Check the logs for successful startup messages:
   ```
   🔍 Checking database initialization status...
   📊 Found 0 climate projects
   📊 Found 0 marketing projects
   📦 Database is empty, importing initial data...
   🌍 Importing climate data...
   ✅ Imported 9 climate projects
   📊 Importing marketing data...
   ✅ Imported MLI project with 8 metrics and 248 data points
   ✅ Database initialization complete!
   Connected to Redis
   Redis cache service initialized successfully
   Database service initialized successfully
   Dashboard Proxy Server running on port 3000
   ```

### 5. Configure Domain (Optional)

1. In Coolify, go to **Domains** section
2. Add your custom domain (e.g., `api.yourdomain.com`)
3. Enable **SSL/TLS** (Let's Encrypt)
4. Coolify will automatically configure the reverse proxy

## Health Checks

The application includes built-in health checks:
- **HTTP Health Check**: `GET /`
- **Interval**: Every 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3 attempts

## Testing Your Deployment

### 1. Test Health Endpoint
```bash
curl https://your-domain.com/
```

### 2. Test with Authentication
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/odoo/partners
```

### 3. Check Cache Stats
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/admin/cache/stats
```

### 4. Test Redis Caching
```bash
# First request (slower - from Odoo)
time curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/odoo/dashboard

# Second request (faster - from Redis)
time curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/odoo/dashboard
```

## Monitoring

### View Logs in Coolify
1. Go to your application in Coolify
2. Click **"Logs"** tab
3. Monitor real-time logs

### Check Application Status
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  https://your-domain.com/admin/status
```

## Scaling

### Horizontal Scaling
To scale your application:
1. In Coolify, go to **Settings**
2. Adjust **Replicas** count
3. Redis will be shared across all instances

### Vertical Scaling
Adjust resource limits in Coolify:
- **CPU**: Recommended 1-2 cores
- **Memory**: Recommended 512MB-1GB
- **Redis Memory**: Recommended 256MB-512MB

## Backup Strategy

### Database Backup
The SQLite database is stored in the `app-data` volume:
```bash
# Backup command (run in Coolify terminal)
docker cp <container_id>:/app/data/proxy_server.db ./backup.db
```

### Redis Backup
Redis data is persisted in `redis-data` volume with AOF (Append Only File) enabled.

## Troubleshooting

### Redis Connection Issues
Check Redis is running:
```bash
docker exec <redis_container> redis-cli ping
```

### Database Issues
Check database file permissions:
```bash
docker exec <app_container> ls -la /app/data/
```

### View Application Logs
```bash
docker logs <container_id> -f
```

## Environment-Specific Configuration

### Development
Use `.env` file locally with:
```env
REDIS_HOST=localhost
DATABASE_PATH=./data/proxy_server.db
```

### Production (Coolify)
Environment variables are managed through Coolify UI.
Redis and database paths are automatically configured via docker-compose.

## Security Best Practices

1. **Use Strong Admin Token**: Generate a secure random token
   ```bash
   openssl rand -base64 32
   ```

2. **Enable HTTPS**: Always use SSL/TLS in production (Coolify handles this)

3. **Restrict Access**: Use Coolify's firewall rules to limit access

4. **Regular Updates**: Keep dependencies updated
   ```bash
   npm audit fix
   ```

5. **Monitor Logs**: Regularly check logs for suspicious activity

## Performance Optimization

### Cache TTL Configuration
Adjust cache TTL based on your needs:
- **Static data** (partners): 3600s (1 hour)
- **Transactional data** (orders): 1800s (30 minutes)
- **Real-time data** (POS, inventory): 300-900s (5-15 minutes)

### Redis Memory Management
Monitor Redis memory usage:
```bash
docker exec <redis_container> redis-cli INFO memory
```

## Support

For issues or questions:
1. Check application logs in Coolify
2. Review this deployment guide
3. Check the main README.md for API documentation

## Updating the Application

1. Push changes to your Git repository
2. In Coolify, click **"Redeploy"**
3. Coolify will rebuild and restart the application
4. Zero-downtime deployment is handled automatically

## Rolling Back

If deployment fails:
1. Go to **Deployments** in Coolify
2. Select a previous successful deployment
3. Click **"Redeploy"** on that version
