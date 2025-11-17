#!/bin/bash

# MLI Schema Deployment Script for Coolify
# This script drops and recreates all MLI tables with the clean schema

set -e  # Exit on any error

echo "======================================"
echo "MLI Schema Reset Deployment"
echo "======================================"
echo ""

# Database path
DB_PATH="./data/proxy_server.db"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Error: Database not found at $DB_PATH"
    exit 1
fi

echo "📍 Database found: $DB_PATH"
echo ""

# Backup database
BACKUP_PATH="./data/proxy_server_backup_$(date +%Y%m%d_%H%M%S).db"
echo "💾 Creating backup: $BACKUP_PATH"
cp "$DB_PATH" "$BACKUP_PATH"
echo "✅ Backup created successfully"
echo ""

# Run migration
echo "🔄 Running migration: 008_drop_and_recreate_mli_tables.sql"
sqlite3 "$DB_PATH" < ./migrations/008_drop_and_recreate_mli_tables.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "======================================"
    echo "Summary:"
    echo "======================================"
    echo "✓ All old MLI tables dropped"
    echo "✓ New clean schema created"
    echo "✓ All indexes created"
    echo "✓ Backup saved to: $BACKUP_PATH"
    echo ""
    echo "🔄 Please restart your application:"
    echo "   In Coolify: Redeploy your service"
    echo "   Or manually: pm2 restart proxy_server"
    echo ""
else
    echo "❌ Migration failed!"
    echo "Restoring from backup..."
    cp "$BACKUP_PATH" "$DB_PATH"
    echo "Database restored from backup"
    exit 1
fi
