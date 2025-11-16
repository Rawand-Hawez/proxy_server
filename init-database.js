#!/usr/bin/env node

const DatabaseService = require('./databaseService');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

function loadMliOpsSeedData(seedPath) {
  return new Promise((resolve, reject) => {
    const seedDb = new sqlite3.Database(seedPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        return reject(err);
      }

      seedDb.all('SELECT * FROM programs', (error, rows) => {
        seedDb.close();
        if (error) {
          reject(error);
        } else {
          resolve(rows || []);
        }
      });
    });
  });
}

async function initializeDatabase() {
  console.log('🔍 Checking database initialization status...');

  const db = new DatabaseService();
  await db.initialize();

  try {
    // Check if we have any climate projects
    const climateProjects = await db.getAllClimateProjects();
    const marketingProjects = await db.getAllMarketingProjects();
    const mliOpsCount = await db.getMliOpsProgramCount();

    console.log(`📊 Found ${climateProjects.length} climate projects`);
    console.log(`📊 Found ${marketingProjects.length} marketing projects`);
    console.log(`📊 Found ${mliOpsCount} MLI operations programs`);

    // If database is empty, import initial data
    if (climateProjects.length === 0 || marketingProjects.length === 0 || mliOpsCount === 0) {
      console.log('📦 Database is empty, importing initial data...');

      // Import climate data if empty
      if (climateProjects.length === 0) {
        console.log('🌍 Importing climate data...');
        const climateDataPath = path.join(__dirname, 'docs/data/climate/climate.js');
        if (fs.existsSync(climateDataPath)) {
          // Read the file content and extract the CLIMATE_DATA object
          const fileContent = fs.readFileSync(climateDataPath, 'utf8');
          const match = fileContent.match(/const CLIMATE_DATA = ({[\s\S]*?});/);

          if (match) {
            const climateData = eval('(' + match[1] + ')');

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
            console.log('⚠️  Could not parse climate data, skipping');
          }
        } else {
          console.log('⚠️  Climate data file not found, skipping');
        }
      }

      // Import marketing data if empty
      if (marketingProjects.length === 0) {
        console.log('📊 Importing marketing data...');
        const mliDataPath = path.join(__dirname, 'docs/data/mli/mli.js');
        if (fs.existsSync(mliDataPath)) {
          // Read the file content and extract the MLI_DATA object
          const fileContent = fs.readFileSync(mliDataPath, 'utf8');
          const match = fileContent.match(/const MLI_DATA = ({[\s\S]*?});/);

          if (match) {
            const mliData = eval('(' + match[1] + ')');

            // Create MLI project
            const projectId = await db.createMarketingProject({
              projectKey: 'mli',
              projectName: 'MLI Marketing',
              description: 'Marketing metrics for MLI project'
            });

            // Define metrics based on the data structure
            const metrics = {
              fb_views: { label: 'Facebook Views', category: 'Facebook' },
              fb_visits: { label: 'Facebook Visits', category: 'Facebook' },
              fb_viewers: { label: 'Facebook Viewers', category: 'Facebook' },
              ig_reach: { label: 'Instagram Reach', category: 'Instagram' },
              ig_interactions: { label: 'Instagram Interactions', category: 'Instagram' },
              ig_views: { label: 'Instagram Views', category: 'Instagram' },
              ig_follows: { label: 'Instagram Follows', category: 'Instagram' },
              ig_visits: { label: 'Instagram Visits', category: 'Instagram' }
            };

            // Create metrics
            const metricIds = {};
            for (const [key, config] of Object.entries(metrics)) {
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
              const metricData = mliData[metricKey];
              if (metricData && Array.isArray(metricData)) {
                for (const point of metricData) {
                  dataPoints.push({
                    projectId: projectId,
                    metricId: metricId,
                    date: point.Date,
                    value: point.Value
                  });
                }
              }
            }

            await db.bulkUpsertMarketingData(dataPoints);
            console.log(`✅ Imported MLI project with ${Object.keys(metricIds).length} metrics and ${dataPoints.length} data points`);
          } else {
            console.log('⚠️  Could not parse MLI data, skipping');
          }
        } else {
          console.log('⚠️  MLI data file not found, skipping');
        }
      }

      if (mliOpsCount === 0) {
        console.log('🏗️ Importing MLI operations data...');
        const seedDbPath = path.join(__dirname, 'docs/data/mli_ops/programs.db');
        if (fs.existsSync(seedDbPath)) {
          try {
            const seedRows = await loadMliOpsSeedData(seedDbPath);
            if (seedRows.length > 0) {
              await db.bulkUpsertMliOpsPrograms(seedRows.map(row => ({
                program: row.program,
                number_of_participants: row.number_of_participants,
                male: row.male,
                female: row.female,
                trainers: row.trainers,
                local_trainer: row.local_trainer,
                expat_trainer: row.expat_trainer,
                duration_days: row.duration_days,
                unit_price: row.unit_price,
                total_revenue_input: row.total_revenue_input,
                status: row.status,
                start_date: row.start_date,
                end_date: row.end_date,
                participant_fee: row.participant_fee,
                non_monetary_revenue: row.non_monetary_revenue,
                actual_revenue: row.actual_revenue
              })));
              console.log(`✅ Imported ${seedRows.length} MLI operations programs`);
            } else {
              console.log('⚠️  MLI operations seed database is empty, skipping');
            }
          } catch (error) {
            console.log('⚠️  Failed to import MLI operations data:', error.message);
          }
        } else {
          console.log('⚠️  MLI operations seed database not found, skipping');
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
