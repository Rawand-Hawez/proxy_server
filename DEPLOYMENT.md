# Deployment Instructions

## MLI Operations Schema Migration

### Quick Deploy to Coolify

1. **Commit and push changes:**
   ```bash
   git add .
   git commit -m "MLI Operations schema cleanup and API updates"
   git push origin main
   ```

2. **In Coolify dashboard:**
   - Navigate to your proxy_server application
   - Click **"Redeploy"** or **"Deploy"**
   - Wait for deployment to complete

3. **Run the migration:**

   After deployment completes, SSH into your server and run:
   ```bash
   cd /app  # or your deployment directory
   ./deploy-mli-schema.sh
   ```

4. **Restart the application:**
   - In Coolify dashboard, click **"Restart"**
   - Or the script will show you how to restart manually

### What This Migration Does

✅ Drops all old MLI tables with deprecated fields
✅ Creates fresh tables with clean schema
✅ Removes old fields: `male`, `female`, `trainers`, `total_revenue_input`, etc.
✅ Uses new fields: `male_participants`, `female_participants`, `cash_revenue`, `total_revenue`
✅ Creates all necessary indexes
✅ Creates automatic backup before migration

### Files Included

- `deploy-mli-schema.sh` - Deployment script
- `migrations/008_drop_and_recreate_mli_tables.sql` - Migration SQL
- `MLI_OPERATIONS_API.md` - API documentation for front-end team
- `databaseService.js` - Updated with new schema

### After Deployment

Your API will return clean responses with only the new fields:

```json
{
  "id": 1,
  "program": "Program Name",
  "number_of_participants": 25,
  "male_participants": 15,
  "female_participants": 10,
  "cash_revenue": 50000,
  "non_monetary_revenue": 10000,
  "total_revenue": 60000,
  "program_cost": 30000,
  "status": "completed",
  "avg_content_rating": 4.5,
  "avg_delivery_rating": 4.3,
  "avg_overall_rating": 4.4
}
```

### Rollback (If Needed)

If something goes wrong, the deployment script creates an automatic backup. To rollback:

```bash
cd /app/data
ls -la proxy_server_backup_*.db  # Find the latest backup
cp proxy_server_backup_YYYYMMDD_HHMMSS.db proxy_server.db
# Restart application
```

### API Documentation

Share `MLI_OPERATIONS_API.md` with your front-end team for complete API reference.

Base URL: `https://proxy.krdholding.dev/api/mli-ops`
