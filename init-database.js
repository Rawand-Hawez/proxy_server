#!/usr/bin/env node

const DatabaseService = require('./databaseService');

async function initializeDatabase() {
  console.log('🔍 Initializing database...');

  const db = new DatabaseService();
  await db.initialize();

  try {
    console.log('✅ Database initialized successfully!');
    console.log('📊 All tables created and ready to use');

    await db.close();
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = initializeDatabase;
