#!/bin/bash

# Migration 009 Deployment Script
# Adds cost breakdown columns to mli_ops_programs table

set -e

echo "======================================"
echo "Applying Migration 009: Cost Breakdown"
echo "======================================"
echo ""

# Database path (adjust if needed, this is the default for the container)
DB_PATH="./data/proxy_server.db"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Error: Database not found at $DB_PATH"
    exit 1
fi

echo "📍 Database found: $DB_PATH"

# Backup database just in case
BACKUP_PATH="./data/proxy_server_pre_009_$(date +%Y%m%d_%H%M%S).db"
echo "💾 Creating backup: $BACKUP_PATH"
cp "$DB_PATH" "$BACKUP_PATH"

# Run migration
echo "🔄 Running migration..."
sqlite3 "$DB_PATH" < ./migrations/009_add_program_cost_breakdown.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
    echo "   Added columns: venue_cost, catering_cost, materials_cost"
else
    echo "❌ Migration failed!"
    echo "Restoring from backup..."
    cp "$BACKUP_PATH" "$DB_PATH"
    exit 1
fi
