#!/usr/bin/env node

const DatabaseService = require('./databaseService');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  console.log('🔍 Checking database initialization status...');

  const db = new DatabaseService();
  await db.initialize();

  try {
    // Check if we have any climate projects
    const climateProjects = await db.getAllClimateProjects();
    const marketingProjects = await db.getAllMarketingProjects();

    console.log(`📊 Found ${climateProjects.length} climate projects`);
    console.log(`📊 Found ${marketingProjects.length} marketing projects`);

    // If database is empty, import initial data
    if (climateProjects.length === 0 || marketingProjects.length === 0) {
      console.log('📦 Database is empty, importing initial data...');

      // Import climate data if empty
      if (climateProjects.length === 0) {
        console.log('🌍 Importing climate data...');
        const climateDataPath = path.join(__dirname, 'docs/data/climate/climate.js');
        if (fs.existsSync(climateDataPath)) {
          const climateData = require(climateDataPath);

          for (const project of climateData.projects) {
            await db.createClimateProject({
              project: project.project,
              amount: project.amount,
              unit: project.unit,
              duration: project.duration,
              status: project.status,
              location: project.location,
              partner: project.partner,
              directBeneficiary: project.directBeneficiary || 0,
              indirectBeneficiary: project.indirectBeneficiary || 0,
              environmentalOutcome: project.environmentalOutcome || '',
              brief: project.brief || ''
            });
          }
          console.log(`✅ Imported ${climateData.projects.length} climate projects`);
        } else {
          console.log('⚠️  Climate data file not found, skipping');
        }
      }

      // Import marketing data if empty
      if (marketingProjects.length === 0) {
        console.log('📊 Importing marketing data...');
        const mliDataPath = path.join(__dirname, 'docs/data/mli/mli.js');
        if (fs.existsSync(mliDataPath)) {
          const mliData = require(mliDataPath);

          // Create MLI project
          const projectId = await db.createMarketingProject({
            projectKey: 'mli',
            projectName: 'MLI Marketing',
            description: 'Marketing metrics for MLI project'
          });

          // Create metrics
          const metricIds = {};
          for (const [key, config] of Object.entries(mliData.metrics)) {
            const metricId = await db.createMarketingMetric({
              projectId: projectId,
              metricKey: key,
              metricLabel: config.label,
              category: config.category
            });
            metricIds[key] = metricId;
          }

          // Import data points
          const dataPoints = [];
          for (const [metricKey, metricId] of Object.entries(metricIds)) {
            const metricData = mliData.data[metricKey];
            if (metricData && Array.isArray(metricData)) {
              for (const point of metricData) {
                dataPoints.push({
                  projectId: projectId,
                  metricId: metricId,
                  date: point.date,
                  value: point.value
                });
              }
            }
          }

          await db.bulkUpsertMarketingData(dataPoints);
          console.log(`✅ Imported MLI project with ${Object.keys(metricIds).length} metrics and ${dataPoints.length} data points`);
        } else {
          console.log('⚠️  MLI data file not found, skipping');
        }
      }

      console.log('✅ Database initialization complete!');
    } else {
      console.log('✅ Database already has data, skipping initialization');
    }

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
