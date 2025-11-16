/**
 * Import MLI Marketing Data Script
 *
 * This script imports the MLI marketing data from docs/data/mli/mli.js
 * into the database.
 *
 * Usage: node scripts/import-mli-marketing-data.js
 */

const DatabaseService = require('../databaseService');

// MLI Data from docs/data/mli/mli.js
const MLI_DATA = {
    fb_views: [
        {"Date": "2025-10-01", "Value": 55}, {"Date": "2025-10-02", "Value": 1}, {"Date": "2025-10-03", "Value": 5}, {"Date": "2025-10-04", "Value": 5}, {"Date": "2025-10-05", "Value": 2}, {"Date": "2025-10-06", "Value": 2}, {"Date": "2025-10-07", "Value": 0}, {"Date": "2025-10-08", "Value": 0}, {"Date": "2025-10-09", "Value": 0}, {"Date": "2025-10-10", "Value": 1}, {"Date": "2025-10-11", "Value": 3}, {"Date": "2025-10-12", "Value": 3}, {"Date": "2025-10-13", "Value": 2}, {"Date": "2025-10-14", "Value": 4}, {"Date": "2025-10-15", "Value": 2}, {"Date": "2025-10-16", "Value": 2}, {"Date": "2025-10-17", "Value": 7}, {"Date": "2025-10-18", "Value": 1}, {"Date": "2025-10-19", "Value": 8}, {"Date": "2025-10-20", "Value": 0}, {"Date": "2025-10-21", "Value": 1}, {"Date": "2025-10-22", "Value": 0}, {"Date": "2025-10-23", "Value": 1}, {"Date": "2025-10-24", "Value": 2}, {"Date": "2025-10-25", "Value": 0}, {"Date": "2025-10-26", "Value": 2}, {"Date": "2025-10-27", "Value": 0}, {"Date": "2025-10-28", "Value": 14}, {"Date": "2025-10-29", "Value": 6829}, {"Date": "2025-10-30", "Value": 21592}, {"Date": "2025-10-31", "Value": 10836}
    ],
    fb_visits: [
        {"Date": "2025-10-01", "Value": 3}, {"Date": "2025-10-02", "Value": 0}, {"Date": "2025-10-03", "Value": 0}, {"Date": "2025-10-04", "Value": 3}, {"Date": "2025-10-05", "Value": 0}, {"Date": "2025-10-06", "Value": 0}, {"Date": "2025-10-07", "Value": 0}, {"Date": "2025-10-08", "Value": 0}, {"Date": "2025-10-09", "Value": 0}, {"Date": "2025-10-10", "Value": 0}, {"Date": "2025-10-11", "Value": 0}, {"Date": "2025-10-12", "Value": 0}, {"Date": "2025-10-13", "Value": 0}, {"Date": "2025-10-14", "Value": 0}, {"Date": "2025-10-15", "Value": 0}, {"Date": "2025-10-16", "Value": 1}, {"Date": "2025-10-17", "Value": 6}, {"Date": "2025-10-18", "Value": 0}, {"Date": "2025-10-19", "Value": 1}, {"Date": "2025-10-20", "Value": 0}, {"Date": "2025-10-21", "Value": 0}, {"Date": "2025-10-22", "Value": 0}, {"Date": "2025-10-23", "Value": 0}, {"Date": "2025-10-24", "Value": 0}, {"Date": "2025-10-25", "Value": 0}, {"Date": "2025-10-26", "Value": 0}, {"Date": "2025-10-27", "Value": 1}, {"Date": "2025-10-28", "Value": 0}, {"Date": "2025-10-29", "Value": 3}, {"Date": "2025-10-30", "Value": 0}, {"Date": "2025-10-31", "Value": 3}
    ],
    fb_viewers: [
        {"Date": "2025-10-01", "Value": 50}, {"Date": "2025-10-02", "Value": 1}, {"Date": "2025-10-03", "Value": 4}, {"Date": "2025-10-04", "Value": 4}, {"Date": "2025-10-05", "Value": 1}, {"Date": "2025-10-06", "Value": 2}, {"Date": "2025-10-07", "Value": 0}, {"Date": "2025-10-08", "Value": 0}, {"Date": "2025-10-09", "Value": 0}, {"Date": "2025-10-10", "Value": 1}, {"Date": "2025-10-11", "Value": 2}, {"Date": "2025-10-12", "Value": 3}, {"Date": "2025-10-13", "Value": 2}, {"Date": "2025-10-14", "Value": 4}, {"Date": "2025-10-15", "Value": 1}, {"Date": "2025-10-16", "Value": 2}, {"Date": "2025-10-17", "Value": 1}, {"Date": "2025-10-18", "Value": 1}, {"Date": "2025-10-19", "Value": 5}, {"Date": "2025-10-20", "Value": 0}, {"Date": "2025-10-21", "Value": 1}, {"Date": "2025-10-22", "Value": 0}, {"Date": "2025-10-23", "Value": 1}, {"Date": "2025-10-24", "Value": 2}, {"Date": "2025-10-25", "Value": 0}, {"Date": "2025-10-26", "Value": 2}, {"Date": "2025-10-27", "Value": 0}, {"Date": "2025-10-28", "Value": 7}, {"Date": "2025-10-29", "Value": 3382}, {"Date": "2025-10-30", "Value": 9974}, {"Date": "2025-10-31", "Value": 4692}
    ],
    ig_reach: [
        {"Date": "2025-10-01", "Value": 55}, {"Date": "2025-10-02", "Value": 38}, {"Date": "2025-10-03", "Value": 37}, {"Date": "2025-10-04", "Value": 44}, {"Date": "2025-10-05", "Value": 255}, {"Date": "2025-10-06", "Value": 262}, {"Date": "2025-10-07", "Value": 86}, {"Date": "2025-10-08", "Value": 33}, {"Date": "2025-10-09", "Value": 45}, {"Date": "2025-10-10", "Value": 41}, {"Date": "2025-10-11", "Value": 31}, {"Date": "2025-10-12", "Value": 53}, {"Date": "2025-10-13", "Value": 26}, {"Date": "2025-10-14", "Value": 27}, {"Date": "2025-10-15", "Value": 26}, {"Date": "2025-10-16", "Value": 28}, {"Date": "2025-10-17", "Value": 25}, {"Date": "2025-10-18", "Value": 21}, {"Date": "2025-10-19", "Value": 277}, {"Date": "2025-10-20", "Value": 77}, {"Date": "2025-10-21", "Value": 417}, {"Date": "2025-10-22", "Value": 303}, {"Date": "2025-10-23", "Value": 142}, {"Date": "2025-10-24", "Value": 118}, {"Date": "2025-10-25", "Value": 58}, {"Date": "2025-10-26", "Value": 55}, {"Date": "2025-10-27", "Value": 26}, {"Date": "2025-10-28", "Value": 630}, {"Date": "2025-10-29", "Value": 3648}, {"Date": "2025-10-30", "Value": 10637}, {"Date": "2025-10-31", "Value": 9046}
    ],
    ig_interactions: [
        {"Date": "2025-10-01", "Value": 4}, {"Date": "2025-10-02", "Value": 7}, {"Date": "2025-10-03", "Value": 4}, {"Date": "2025-10-04", "Value": 2}, {"Date": "2025-10-05", "Value": 2}, {"Date": "2025-10-06", "Value": 6}, {"Date": "2025-10-07", "Value": 2}, {"Date": "2025-10-08", "Value": 2}, {"Date": "2025-10-09", "Value": 3}, {"Date": "2025-10-10", "Value": 4}, {"Date": "2025-10-11", "Value": 0}, {"Date": "2025-10-12", "Value": 6}, {"Date": "2025-10-13", "Value": 0}, {"Date": "2025-10-14", "Value": 1}, {"Date": "2025-10-15", "Value": 1}, {"Date": "2025-10-16", "Value": 0}, {"Date": "2025-10-17", "Value": 1}, {"Date": "2025-10-18", "Value": 1}, {"Date": "2025-10-19", "Value": 17}, {"Date": "2025-10-20", "Value": 0}, {"Date": "2025-10-21", "Value": 6}, {"Date": "2025-10-22", "Value": 3}, {"Date": "2025-10-23", "Value": 4}, {"Date": "2025-10-24", "Value": 2}, {"Date": "2025-10-25", "Value": 0}, {"Date": "2025-10-26", "Value": 0}, {"Date": "2025-10-27", "Value": 3}, {"Date": "2025-10-28", "Value": 42}, {"Date": "2025-10-29", "Value": 125}, {"Date": "2025-10-30", "Value": 195}, {"Date": "2025-10-31", "Value": 155}
    ],
    ig_views: [
        {"Date": "2025-10-01", "Value": 341}, {"Date": "2025-10-02", "Value": 470}, {"Date": "2025-10-03", "Value": 282}, {"Date": "2025-10-04", "Value": 375}, {"Date": "2025-10-05", "Value": 1286}, {"Date": "2025-10-06", "Value": 1360}, {"Date": "2025-10-07", "Value": 1154}, {"Date": "2025-10-08", "Value": 316}, {"Date": "2025-10-09", "Value": 674}, {"Date": "2025-10-10", "Value": 219}, {"Date": "2025-10-11", "Value": 308}, {"Date": "2025-10-12", "Value": 759}, {"Date": "2025-10-13", "Value": 167}, {"Date": "2025-10-14", "Value": 630}, {"Date": "2025-10-15", "Value": 566}, {"Date": "2025-10-16", "Value": 519}, {"Date": "2025-10-17", "Value": 415}, {"Date": "2025-10-18", "Value": 553}, {"Date": "2025-10-19", "Value": 2676}, {"Date": "2025-10-20", "Value": 625}, {"Date": "2025-10-21", "Value": 790}, {"Date": "2025-10-22", "Value": 916}, {"Date": "2025-10-23", "Value": 423}, {"Date": "2025-10-24", "Value": 642}, {"Date": "2025-10-25", "Value": 470}, {"Date": "2025-10-26", "Value": 248}, {"Date": "2025-10-27", "Value": 549}, {"Date": "2025-10-28", "Value": 1954}, {"Date": "2025-10-29", "Value": 6156}, {"Date": "2025-10-30", "Value": 19234}, {"Date": "2025-10-31", "Value": 17219}
    ],
    ig_follows: [
        {"Date": "2025-10-01", "Value": 6}, {"Date": "2025-10-02", "Value": 7}, {"Date": "2025-10-03", "Value": 3}, {"Date": "2025-10-04", "Value": 9}, {"Date": "2025-10-05", "Value": 7}, {"Date": "2025-10-06", "Value": 6}, {"Date": "2025-10-07", "Value": 5}, {"Date": "2025-10-08", "Value": 8}, {"Date": "2025-10-09", "Value": 9}, {"Date": "2025-10-10", "Value": 5}, {"Date": "2025-10-11", "Value": 8}, {"Date": "2025-10-12", "Value": 6}, {"Date": "2025-10-13", "Value": 8}, {"Date": "2025-10-14", "Value": 6}, {"Date": "2025-10-15", "Value": 5}, {"Date": "2025-10-16", "Value": 5}, {"Date": "2025-10-17", "Value": 7}, {"Date": "2025-10-18", "Value": 2}, {"Date": "2025-10-19", "Value": 8}, {"Date": "2025-10-20", "Value": 5}, {"Date": "2025-10-21", "Value": 6}, {"Date": "2025-10-22", "Value": 5}, {"Date": "2025-10-23", "Value": 5}, {"Date": "2025-10-24", "Value": 5}, {"Date": "2025-10-25", "Value": 8}, {"Date": "2025-10-26", "Value": 2}, {"Date": "2025-10-27", "Value": 7}, {"Date": "2025-10-28", "Value": 6}, {"Date": "2025-10-29", "Value": 9}, {"Date": "2025-10-30", "Value": 4}, {"Date": "2025-10-31", "Value": 5}
    ],
    ig_visits: [
        {"Date": "2025-10-01", "Value": 24}, {"Date": "2025-10-02", "Value": 23}, {"Date": "2025-10-03", "Value": 24}, {"Date": "2025-10-04", "Value": 24}, {"Date": "2025-10-05", "Value": 28}, {"Date": "2025-10-06", "Value": 40}, {"Date": "2025-10-07", "Value": 31}, {"Date": "2025-10-08", "Value": 22}, {"Date": "2025-10-09", "Value": 34}, {"Date": "2025-10-10", "Value": 31}, {"Date": "2025-10-11", "Value": 25}, {"Date": "2025-10-12", "Value": 52}, {"Date": "2025-10-13", "Value": 22}, {"Date": "2025-10-14", "Value": 30}, {"Date": "2025-10-15", "Value": 43}, {"Date": "2025-10-16", "Value": 61}, {"Date": "2025-10-17", "Value": 44}, {"Date": "2025-10-18", "Value": 49}, {"Date": "2025-10-19", "Value": 92}, {"Date": "2025-10-20", "Value": 43}, {"Date": "2025-10-21", "Value": 28}, {"Date": "2025-10-22", "Value": 38}, {"Date": "2025-10-23", "Value": 28}, {"Date": "2025-10-24", "Value": 30}, {"Date": "2025-10-25", "Value": 32}, {"Date": "2025-10-26", "Value": 20}, {"Date": "2025-10-27", "Value": 29}, {"Date": "2025-10-28", "Value": 58}, {"Date": "2025-10-29", "Value": 31}, {"Date": "2025-10-30", "Value": 38}, {"Date": "2025-10-31", "Value": 44}
    ]
};

const METRICS_CONFIG = [
    { metricKey: 'fb_views', metricLabel: 'Facebook Views', category: 'facebook' },
    { metricKey: 'fb_visits', metricLabel: 'Facebook Visits', category: 'facebook' },
    { metricKey: 'fb_viewers', metricLabel: 'Facebook Viewers', category: 'facebook' },
    { metricKey: 'ig_reach', metricLabel: 'Instagram Reach', category: 'instagram' },
    { metricKey: 'ig_interactions', metricLabel: 'Instagram Interactions', category: 'instagram' },
    { metricKey: 'ig_views', metricLabel: 'Instagram Views', category: 'instagram' },
    { metricKey: 'ig_follows', metricLabel: 'Instagram Follows', category: 'instagram' },
    { metricKey: 'ig_visits', metricLabel: 'Instagram Visits', category: 'instagram' }
];

async function importMLIMarketingData() {
    const dbService = new DatabaseService(process.env.DATABASE_PATH || './data/proxy_server.db');

    try {
        console.log('Initializing database connection...');
        await dbService.initialize();
        console.log('Database initialized successfully\n');

        // Step 1: Create MLI Project
        console.log('Step 1: Creating MLI marketing project...');
        let projectId;
        const existingProject = await dbService.getMarketingProjectByKey('mli');

        if (existingProject) {
            console.log('MLI project already exists (ID: ' + existingProject.id + ')');
            projectId = existingProject.id;
        } else {
            projectId = await dbService.createMarketingProject({
                projectKey: 'mli',
                projectName: 'MLI Marketing',
                description: 'Marketing metrics for MLI project - Facebook and Instagram performance data'
            });
            console.log(`✓ Created MLI project (ID: ${projectId})`);
        }

        // Step 2: Create Metrics
        console.log('\nStep 2: Creating metrics...');
        const metricIds = {};

        for (const metric of METRICS_CONFIG) {
            const existing = await dbService.getMarketingMetricByKey(projectId, metric.metricKey);
            if (existing) {
                console.log(`  ✓ Metric "${metric.metricLabel}" already exists`);
                metricIds[metric.metricKey] = existing.id;
            } else {
                const id = await dbService.createMarketingMetric({
                    projectId,
                    metricKey: metric.metricKey,
                    metricLabel: metric.metricLabel,
                    category: metric.category
                });
                metricIds[metric.metricKey] = id;
                console.log(`  ✓ Created metric: ${metric.metricLabel} (ID: ${id})`);
            }
        }

        // Step 3: Import Data
        console.log('\nStep 3: Importing time-series data...');
        let totalDataPoints = 0;

        for (const [metricKey, dataPoints] of Object.entries(MLI_DATA)) {
            console.log(`  Importing ${metricKey}: ${dataPoints.length} data points...`);

            const dataToImport = dataPoints.map(dp => ({
                projectId,
                metricId: metricIds[metricKey],
                date: dp.Date,
                value: dp.Value
            }));

            await dbService.bulkUpsertMarketingData(dataToImport);
            totalDataPoints += dataPoints.length;
            console.log(`  ✓ Imported ${dataPoints.length} data points for ${metricKey}`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('Import Summary:');
        console.log('='.repeat(60));
        console.log(`Project: MLI Marketing (ID: ${projectId})`);
        console.log(`Metrics Created: ${Object.keys(metricIds).length}`);
        console.log(`Data Points Imported: ${totalDataPoints}`);
        console.log('='.repeat(60));

        // Step 4: Display Sample Stats
        console.log('\nSample Statistics (Oct 2025):');
        console.log('='.repeat(60));
        const stats = await dbService.getMarketingStats(projectId, '2025-10-01', '2025-10-31');

        stats.slice(0, 5).forEach(stat => {
            console.log(`${stat.metricLabel}:`);
            console.log(`  Total: ${stat.total.toLocaleString()}`);
            console.log(`  Average: ${stat.average.toFixed(2)}`);
            console.log(`  Max: ${stat.max}`);
            console.log(`  Min: ${stat.min}`);
        });
        console.log('='.repeat(60));

        console.log('\n✓ MLI marketing data import completed successfully!');
        console.log('\nYou can now access the data via API:');
        console.log('  GET /api/marketing/projects/mli/data?from=2025-10-01&to=2025-10-31');
        console.log('  GET /api/marketing/projects/mli/stats?from=2025-10-01&to=2025-10-31\n');

    } catch (error) {
        console.error('Error during import:', error);
        process.exit(1);
    } finally {
        await dbService.close();
        process.exit(0);
    }
}

// Run the import
importMLIMarketingData();
