/**
 * Import Climate Data Script
 *
 * This script imports the hardcoded climate data from docs/data/climate/climate.js
 * into the database. Run this once to migrate from hardcoded data to database.
 *
 * Usage: node scripts/import-climate-data.js
 */

const DatabaseService = require('../databaseService');

// Climate data from docs/data/climate/climate.js
const CLIMATE_DATA = {
    projects: [
        {
            no: 1,
            project: "Recycle Bins",
            amount: 500,
            unit: "Bins",
            duration: "July - Aug",
            status: "Done",
            location: "Hawler & Duhok",
            partner: "Ministry of Municipality and Tourism",
            directBeneficiary: 15,
            indirectBeneficiary: 25000,
            environmentalOutcome: "8 ton/monthly plastics saved to be recycled that is 96 tons per year",
            brief: "Installing 350 in Hawler and 150 in Duhok for collecting the plastic and nylon waste to be recycled."
        },
        {
            no: 3,
            project: "Tote Bag",
            amount: 1100,
            unit: "Bags",
            duration: "June - Aug",
            status: "Done",
            location: "Kurdistan",
            partner: "Carrefour",
            directBeneficiary: 1100,
            indirectBeneficiary: 5500,
            environmentalOutcome: "Each Tote Bag can replace around 240 bags per year, that is 264,000 plastic/nylon bags reduced",
            brief: "Distribution of 1,100 bags to support community by reducing the plastic bags waste"
        },
        {
            no: 5,
            project: "Zhinga Dost",
            amount: 15,
            unit: "People",
            duration: "Aug - Dec",
            status: "In Progress",
            location: "Kurdistan",
            partner: "-",
            directBeneficiary: 12,
            indirectBeneficiary: 30000,
            environmentalOutcome: "Promoting cleaner, healthier, and more encouraged community by posting public awareness videos which include long-term environmental initiatives.",
            brief: "Exploring a Zhinga Dost hashtag for Kurdistan community to support environment by implementing an invitative. At the end of the project 15 Climate Ambassadors will be awarded."
        },
        {
            no: 7,
            project: "Zakho Conference",
            amount: 2,
            unit: "Days",
            duration: "July",
            status: "Done",
            location: "Zakho",
            partner: "Zakho Independent Administration",
            directBeneficiary: 220,
            indirectBeneficiary: 40000,
            environmentalOutcome: "Inhancing awarness of green urban solutions, support for increasing 1-2% in city, and highlighting key problems and solutions toward green city.",
            brief: "Organizing a two-day conference and training for 37 youth to spotlight key environmental issues and solutions toward becoming an eco-friendly city."
        },
        {
            no: 9,
            project: "Planting Future's Hope",
            amount: 500,
            unit: "Seeds",
            duration: "Feb - Apr",
            status: "Done",
            location: "Hawler",
            partner: "Hawler Medical University",
            directBeneficiary: 500,
            indirectBeneficiary: 1000,
            environmentalOutcome: "Capturing nearly 4 tCO2 per year through the project, raising awareness among students, and participating 500 students in the plantation method.",
            brief: "Distributing seed packets to university students in Hawler Medical University (HMU)."
        },
        {
            no: 10,
            project: "Ramadhan Bazar Donation",
            amount: 2000,
            unit: "Clothes pcs",
            duration: "Feb - Apr",
            status: "Done",
            location: "Hawler",
            partner: "-",
            directBeneficiary: 500,
            indirectBeneficiary: 2000,
            environmentalOutcome: "The booth prevented up to 1,000 kg of textile waste and saved approximately 5.4 million litres of water and 8 tons of CO₂ emissions.",
            brief: "Installing a booth to collect and donate clothes from the community and upcycle to foster sustainable solutions"
        },
        {
            no: 11,
            project: "Tree Donation",
            amount: 500,
            unit: "Trees",
            duration: "Feb - Apr",
            status: "Done",
            location: "Duhok",
            partner: "University of Duhok",
            directBeneficiary: 50,
            indirectBeneficiary: 1000,
            environmentalOutcome: "Capturing nearly 4 tCO2 per year through the project, raising awareness among students, and participating 500 students in the plantation method.",
            brief: "Donating trees to University of Duhok at the same day of opening the volunteer krd club"
        },
        {
            no: 12,
            project: "Eco-run - Earth Day Marathon",
            amount: 500,
            unit: "People",
            duration: "April",
            status: "Done",
            location: "Hawler",
            partner: "Hasar Organization",
            directBeneficiary: 1000,
            indirectBeneficiary: 1000,
            environmentalOutcome: "Raising awareness and inspire the community to adapt eco-friendly habits in daily life.",
            brief: "An eco-friendly running event implemented to raise environmental awareness and inspire sustainable living."
        },
        {
            no: 13,
            project: "Go Green Project",
            amount: 400,
            unit: "Trees",
            duration: "Feb - Apr",
            status: "Done",
            location: "Soran",
            partner: "Honor",
            directBeneficiary: 30,
            indirectBeneficiary: 800,
            environmentalOutcome: "Capturing nearly 3.2 tCO2 per year through the project, raising awareness among volunteers.",
            brief: "Initiating a tree planting initiative ahead of Earth Day in Soran City by planting 400 trees."
        }
    ]
};

async function importClimateData() {
    const dbService = new DatabaseService(process.env.DATABASE_PATH || './data/proxy_server.db');

    try {
        console.log('Initializing database connection...');
        await dbService.initialize();
        console.log('Database initialized successfully\n');

        console.log(`Importing ${CLIMATE_DATA.projects.length} climate projects...\n`);

        let successCount = 0;
        let errorCount = 0;

        for (const project of CLIMATE_DATA.projects) {
            try {
                const id = await dbService.createClimateProject(project);
                console.log(`✓ Imported: "${project.project}" (ID: ${id})`);
                successCount++;
            } catch (error) {
                console.error(`✗ Failed to import "${project.project}":`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('Import Summary:');
        console.log('='.repeat(60));
        console.log(`Total Projects: ${CLIMATE_DATA.projects.length}`);
        console.log(`Successfully Imported: ${successCount}`);
        console.log(`Failed: ${errorCount}`);
        console.log('='.repeat(60));

        // Display stats
        const stats = await dbService.getClimateProjectStats();
        console.log('\nDatabase Statistics:');
        console.log('='.repeat(60));
        console.log(`Total Projects: ${stats.totalProjects}`);
        console.log(`Direct Beneficiaries: ${stats.directBeneficiaries.toLocaleString()}`);
        console.log(`Indirect Beneficiaries: ${stats.indirectBeneficiaries.toLocaleString()}`);
        console.log(`Completed Projects: ${stats.projectsByStatus.done}`);
        console.log(`In Progress: ${stats.projectsByStatus.inProgress}`);
        console.log('='.repeat(60));

        console.log('\n✓ Climate data import completed successfully!');
        console.log('You can now access the admin interface at: http://localhost:3000/admin/climate\n');

    } catch (error) {
        console.error('Error during import:', error);
        process.exit(1);
    } finally {
        await dbService.close();
        process.exit(0);
    }
}

// Run the import
importClimateData();
