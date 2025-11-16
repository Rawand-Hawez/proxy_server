# Database Deployment for Coolify

## Overview

The application uses automatic database initialization on first deployment. This ensures both climate and marketing data are available in production without manual intervention.

## How It Works

### Automatic Initialization

When the Docker container starts, it runs `init-database.js` which:

1. **Checks existing data**: Queries the database to see if climate and marketing projects exist
2. **Imports only if empty**: Only imports data if the respective tables are empty
3. **Idempotent**: Safe to run multiple times - won't duplicate data
4. **Logs progress**: Clear console output shows what's being imported

### Data Sources

The initialization script imports from:
- **Climate Data**: `docs/data/climate/climate.js` → `climate_projects` table
- **Marketing Data**: `docs/data/mli/mli.js` → `marketing_projects`, `marketing_metrics`, `marketing_data` tables

### First Deployment

On your first Coolify deployment:

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
```

### Subsequent Deployments

On redeployments (when data already exists):

```
🔍 Checking database initialization status...
📊 Found 9 climate projects
📊 Found 1 marketing projects
✅ Database already has data, skipping initialization
```

## Deployment Steps for Coolify

1. **Push your code** to the git repository:
   ```bash
   git add .
   git commit -m "Add automatic database initialization"
   git push
   ```

2. **Deploy in Coolify**:
   - Click "Deploy" or "Redeploy"
   - Watch the build logs for the initialization messages
   - Wait for the container to become healthy

3. **Verify the data**:
   ```bash
   # Test climate data
   curl https://proxy.krdholding.dev/api/climate/projects

   # Test marketing data
   curl https://proxy.krdholding.dev/api/marketing/mli/data?from=2025-10-01&to=2025-10-31
   ```

## Persistent Storage

The database is stored in a Docker volume (`app-data`) which:
- Persists between deployments
- Survives container restarts
- Is backed up by Coolify (if configured)

**Location**: `/app/data/proxy_server.db` inside the container

## Adding New Data

### Option 1: Via Admin Interface (Coming Soon)
Use the web UI to add/edit projects and data.

### Option 2: Via API
Use the bulk upload endpoints:
```bash
# Climate projects
curl -X POST https://proxy.krdholding.dev/api/climate/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project": "New Project", ...}'

# Marketing data
curl -X POST https://proxy.krdholding.dev/api/marketing/mli/data/bulk \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"dataPoints": [...]}'
```

### Option 3: Update Source Files
1. Update `docs/data/climate/climate.js` or `docs/data/mli/mli.js`
2. Delete the production database (forces re-initialization)
3. Redeploy in Coolify

**To delete production database:**
```bash
# SSH into Coolify server or use the Coolify terminal
docker exec -it <container-name> rm /app/data/proxy_server.db
# Then redeploy
```

## Backup Strategy

### Manual Backup
```bash
# Copy database from container
docker cp <container-name>:/app/data/proxy_server.db ./backup-$(date +%Y%m%d).db

# Restore database
docker cp ./backup-20250101.db <container-name>:/app/data/proxy_server.db
docker restart <container-name>
```

### Automated Backup (Recommended)
Set up Coolify volume backups or use a cron job:
```bash
# Daily backup script
0 2 * * * docker cp $(docker ps -qf name=proxy_server):/app/data/proxy_server.db /backups/proxy_server-$(date +\%Y\%m\%d).db
```

## Troubleshooting

### Database Not Initializing

Check the container logs:
```bash
docker logs <container-name>
```

Look for initialization messages. If you see errors, common issues:
- Missing `docs/` directory in the Docker image
- Permission issues on `/app/data/`
- Corrupted database file

### Force Re-initialization

To force a fresh import:
```bash
# Stop the container
docker stop <container-name>

# Remove the database file
docker exec <container-name> rm /app/data/proxy_server.db

# Restart (initialization will run)
docker start <container-name>
```

### Data Exists But API Returns Empty

This indicates the API is working but the database query is failing. Check:
1. Authentication token is correct
2. Project key is correct (e.g., `mli` not `MLI`)
3. Date range includes data points
4. Database service is initialized

## Migration from Local Development

If you have local data you want to deploy:

### Method 1: Copy Database File
```bash
# From your local machine
scp ./data/proxy_server.db user@coolify-server:/tmp/

# On Coolify server
docker cp /tmp/proxy_server.db <container-name>:/app/data/
docker restart <container-name>
```

### Method 2: Export and Import via API
```bash
# Export from local
curl http://localhost:3000/api/climate/projects > climate-export.json
curl http://localhost:3000/api/marketing/projects > marketing-export.json

# Import to production (requires custom import script)
# Or manually add via the API endpoints
```

## Environment Variables

No special environment variables needed for database initialization. The standard variables from `COOLIFY_DEPLOYMENT.md` are sufficient.

The database path is set via:
```env
DATABASE_PATH=/app/data/proxy_server.db
```

This is already configured in `docker-compose.yml`.

## File Structure in Container

```
/app/
├── server.js
├── databaseService.js
├── init-database.js          # Initialization script
├── docs/
│   └── data/
│       ├── climate/
│       │   └── climate.js     # Climate seed data
│       └── mli/
│           └── mli.js         # Marketing seed data
└── data/
    └── proxy_server.db        # SQLite database (persistent volume)
```

## Best Practices

1. **Always test locally first**: Run the same initialization on your local environment before deploying
2. **Monitor logs**: Check initialization logs on first deployment
3. **Backup before updates**: Always backup the database before major updates
4. **Use admin interfaces**: Prefer UI/API updates over direct database manipulation
5. **Version control your seed data**: Keep `docs/data/` files in git for reproducibility
