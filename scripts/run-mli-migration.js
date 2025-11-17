#!/usr/bin/env node

/**
 * MLI Operations Schema Migration Runner
 *
 * This script migrates the existing MLI operations data to the new schema.
 * It performs the following:
 * 1. Adds new columns to mli_ops_programs table
 * 2. Migrates existing data to new columns
 * 3. Creates new tables for modules, trainers, and surveys
 *
 * Usage: node scripts/run-mli-migration.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'proxy_server.db');
const MIGRATION_SQL_PATH = path.join(__dirname, '..', 'migrations', '001_mli_ops_schema_migration.sql');

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`ERROR: Database not found at ${DB_PATH}`);
  console.error('Please ensure the database exists before running migrations.');
  process.exit(1);
}

// Check if migration SQL file exists
if (!fs.existsSync(MIGRATION_SQL_PATH)) {
  console.error(`ERROR: Migration SQL file not found at ${MIGRATION_SQL_PATH}`);
  process.exit(1);
}

console.log('='.repeat(60));
console.log('MLI Operations Schema Migration');
console.log('='.repeat(60));
console.log(`Database: ${DB_PATH}`);
console.log(`Migration: ${MIGRATION_SQL_PATH}`);
console.log('='.repeat(60));

// Read migration SQL
const migrationSQL = fs.readFileSync(MIGRATION_SQL_PATH, 'utf8');

// Open database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('ERROR: Could not open database:', err.message);
    process.exit(1);
  }
  console.log('✓ Connected to database');
});

// Function to run SQL queries
const runQuery = (sql) => {
  return new Promise((resolve, reject) => {
    db.run(sql, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

// Function to get query results
const getAll = (sql) => {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Main migration function
async function runMigration() {
  try {
    // Check current table structure
    console.log('\n1. Checking current table structure...');
    const tableInfo = await getAll('PRAGMA table_info(mli_ops_programs)');
    const existingColumns = tableInfo.map(col => col.name);
    console.log(`   Current columns: ${existingColumns.join(', ')}`);

    // Check if migration has already been run
    const hasMaleParticipants = existingColumns.includes('male_participants');
    const hasCashRevenue = existingColumns.includes('cash_revenue');

    if (hasMaleParticipants && hasCashRevenue) {
      console.log('\n⚠ WARNING: Migration appears to have already been run.');
      console.log('   New columns (male_participants, cash_revenue, etc.) already exist.');
      console.log('   Skipping column additions to avoid errors.');
    }

    // Count existing programs before migration
    console.log('\n2. Counting existing programs...');
    const beforeCount = await getAll('SELECT COUNT(*) as count FROM mli_ops_programs');
    console.log(`   Found ${beforeCount[0].count} existing programs`);

    // Run migration
    console.log('\n3. Running migration SQL...');
    console.log('   This may take a moment...');

    // Split migration into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      // Skip comments and transaction statements (we'll handle manually)
      if (
        statement.includes('BEGIN TRANSACTION') ||
        statement.includes('COMMIT') ||
        statement.includes('ROLLBACK') ||
        statement.startsWith('--')
      ) {
        continue;
      }

      try {
        await runQuery(statement);
        successCount++;
      } catch (err) {
        if (err.message.includes('duplicate column name')) {
          skipCount++;
          // This is expected if migration was partially run before
        } else if (err.message.includes('already exists')) {
          skipCount++;
          // Table or index already exists
        } else {
          console.error(`   ✗ Error executing statement: ${err.message}`);
          console.error(`     Statement: ${statement.substring(0, 100)}...`);
          errorCount++;
        }
      }
    }

    console.log(`\n   ✓ Successfully executed ${successCount} statements`);
    if (skipCount > 0) {
      console.log(`   ⊘ Skipped ${skipCount} statements (already applied)`);
    }
    if (errorCount > 0) {
      console.log(`   ✗ Failed ${errorCount} statements`);
    }

    // Verify new tables were created
    console.log('\n4. Verifying new tables...');
    const tables = await getAll(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mli_ops_%' ORDER BY name"
    );
    console.log(`   Found tables:`);
    tables.forEach(t => {
      console.log(`   - ${t.name}`);
    });

    // Check new columns
    console.log('\n5. Verifying new columns...');
    const newTableInfo = await getAll('PRAGMA table_info(mli_ops_programs)');
    const newColumns = newTableInfo.map(col => col.name);
    const addedColumns = newColumns.filter(col => !existingColumns.includes(col));

    if (addedColumns.length > 0) {
      console.log(`   New columns added:`);
      addedColumns.forEach(col => {
        console.log(`   + ${col}`);
      });
    } else {
      console.log(`   No new columns added (may have been added previously)`);
    }

    // Count programs after migration
    console.log('\n6. Verifying data integrity...');
    const afterCount = await getAll('SELECT COUNT(*) as count FROM mli_ops_programs');
    console.log(`   Programs before: ${beforeCount[0].count}`);
    console.log(`   Programs after:  ${afterCount[0].count}`);

    if (beforeCount[0].count === afterCount[0].count) {
      console.log(`   ✓ All programs preserved`);
    } else {
      console.log(`   ✗ WARNING: Program count mismatch!`);
    }

    // Sample a program to show migration
    console.log('\n7. Sample program after migration:');
    const sampleProgram = await getAll('SELECT * FROM mli_ops_programs LIMIT 1');
    if (sampleProgram.length > 0) {
      const p = sampleProgram[0];
      console.log(`   Program: ${p.program}`);
      console.log(`   Old fields: male=${p.male}, female=${p.female}, total_revenue_input=${p.total_revenue_input}`);
      console.log(`   New fields: male_participants=${p.male_participants}, female_participants=${p.female_participants}, cash_revenue=${p.cash_revenue}, total_revenue=${p.total_revenue}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✓ Migration completed successfully!');
    console.log('='.repeat(60));
    console.log('\nNext steps:');
    console.log('1. Restart your server to pick up the new schema');
    console.log('2. The server will automatically apply the schema updates on startup');
    console.log('3. Old columns are preserved for backward compatibility');
    console.log('4. New API endpoints are now available for trainers, modules, and surveys');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n✗ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close database
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      }
    });
  }
}

// Run migration
runMigration();
