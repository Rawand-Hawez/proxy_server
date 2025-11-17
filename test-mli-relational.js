#!/usr/bin/env node

/**
 * MLI Operations Relational Tables Test Script
 * Tests trainers, modules, and surveys tables
 */

const DatabaseService = require('./databaseService');

async function runTests() {
  console.log('🧪 Starting MLI Relational Tables CRUD Tests\n');

  const db = new DatabaseService('./data/proxy_server.db');
  await db.initialize();

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ============================================================================
    // TEST 1: Create a program first
    // ============================================================================
    console.log('📝 TEST 1: Create a test program');
    const programId = await db.upsertMliOpsProgram({
      program: 'Relational Test Program',
      number_of_participants: 20,
      male_participants: 12,
      female_participants: 8,
      cash_revenue: 40000,
      status: 'completed',
      start_date: '2025-01-15',
      end_date: '2025-01-20'
    });

    if (programId) {
      console.log(`✅ PASS: Created program with ID ${programId}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Could not create program');
      testsFailed++;
    }

    // ============================================================================
    // TEST 2: Create trainers
    // ============================================================================
    console.log('\n👨‍🏫 TEST 2: Create trainers');
    const localTrainerId = await db.createTrainer({
      full_name: 'Ahmed Hassan',
      trainer_type: 'local',
      email: 'ahmed@example.com',
      phone: '+20-123-456-7890',
      active: 1
    });

    const expatTrainerId = await db.createTrainer({
      full_name: 'John Smith',
      trainer_type: 'expat',
      email: 'john@example.com',
      phone: '+1-555-123-4567',
      active: 1
    });

    if (localTrainerId && expatTrainerId) {
      console.log(`✅ PASS: Created trainers (Local ID: ${localTrainerId}, Expat ID: ${expatTrainerId})`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Could not create trainers');
      testsFailed++;
    }

    // ============================================================================
    // TEST 3: List trainers
    // ============================================================================
    console.log('\n📋 TEST 3: List all trainers');
    const trainers = await db.getAllTrainers();

    if (trainers.length === 2) {
      console.log('✅ PASS: Listed all trainers');
      trainers.forEach(t => {
        console.log(`   - ${t.full_name} (${t.trainer_type})`);
      });
      testsPassed++;
    } else {
      console.log(`❌ FAIL: Expected 2 trainers, found ${trainers.length}`);
      testsFailed++;
    }

    // ============================================================================
    // TEST 4: Create modules
    // ============================================================================
    console.log('\n📚 TEST 4: Create program modules');
    const module1Id = await db.createModule({
      program_id: programId,
      name: 'Module 1: Leadership',
      description: 'Leadership and management skills',
      duration_days: 3,
      unit_price: 5000
    });

    const module2Id = await db.createModule({
      program_id: programId,
      name: 'Module 2: Communication',
      description: 'Effective communication techniques',
      duration_days: 2,
      unit_price: 3000
    });

    if (module1Id && module2Id) {
      console.log(`✅ PASS: Created modules (Module 1 ID: ${module1Id}, Module 2 ID: ${module2Id})`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Could not create modules');
      testsFailed++;
    }

    // ============================================================================
    // TEST 5: List modules for program
    // ============================================================================
    console.log('\n📖 TEST 5: List modules for program');
    const modules = await db.getModulesByProgramId(programId);

    if (modules.length === 2) {
      console.log('✅ PASS: Listed all modules');
      modules.forEach(m => {
        console.log(`   - ${m.name} (${m.duration_days} days, $${m.unit_price})`);
      });
      testsPassed++;
    } else {
      console.log(`❌ FAIL: Expected 2 modules, found ${modules.length}`);
      testsFailed++;
    }

    // ============================================================================
    // TEST 6: Assign trainers to modules
    // ============================================================================
    console.log('\n🔗 TEST 6: Assign trainers to modules');
    const assignment1 = await db.assignTrainerToModule({
      module_id: module1Id,
      trainer_id: localTrainerId,
      role: 'Lead Trainer',
      trainer_fee: 2000
    });

    const assignment2 = await db.assignTrainerToModule({
      module_id: module2Id,
      trainer_id: expatTrainerId,
      role: 'Lead Trainer',
      trainer_fee: 3000
    });

    if (assignment1 && assignment2) {
      console.log('✅ PASS: Assigned trainers to modules');
      testsPassed++;
    } else {
      console.log('❌ FAIL: Could not assign trainers to modules');
      testsFailed++;
    }

    // ============================================================================
    // TEST 7: Get trainers for a module
    // ============================================================================
    console.log('\n👥 TEST 7: Get trainers for a module');
    const moduleTrainers = await db.getModuleTrainers(module1Id);

    if (moduleTrainers.length === 1 && moduleTrainers[0].full_name === 'Ahmed Hassan') {
      console.log('✅ PASS: Retrieved module trainers');
      console.log(`   - ${moduleTrainers[0].full_name} (${moduleTrainers[0].role}, Fee: $${moduleTrainers[0].trainer_fee})`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Could not retrieve module trainers');
      testsFailed++;
    }

    // ============================================================================
    // TEST 8: Create program surveys
    // ============================================================================
    console.log('\n📊 TEST 8: Create program surveys');
    await db.createSurvey({
      program_id: programId,
      respondent_type: 'participant',
      content_rating: 5,
      delivery_rating: 4,
      overall_rating: 4.5,
      comments: 'Excellent program!'
    });

    await db.createSurvey({
      program_id: programId,
      respondent_type: 'participant',
      content_rating: 4,
      delivery_rating: 5,
      overall_rating: 4.5,
      comments: 'Great delivery!'
    });

    const surveys = await db.getSurveysByProgramId(programId);

    if (surveys.length === 2) {
      console.log('✅ PASS: Created and retrieved surveys');
      testsPassed++;
    } else {
      console.log(`❌ FAIL: Expected 2 surveys, found ${surveys.length}`);
      testsFailed++;
    }

    // ============================================================================
    // TEST 9: Get survey aggregates
    // ============================================================================
    console.log('\n🧮 TEST 9: Calculate survey aggregates');
    const aggregates = await db.getProgramSurveyAggregates(programId);

    if (aggregates.totalResponses === 2 && aggregates.avgContentRating === 4.5) {
      console.log('✅ PASS: Survey aggregates calculated correctly');
      console.log(`   Total Responses: ${aggregates.totalResponses}`);
      console.log(`   Avg Content Rating: ${aggregates.avgContentRating}`);
      console.log(`   Avg Delivery Rating: ${aggregates.avgDeliveryRating}`);
      console.log(`   Avg Overall Rating: ${aggregates.avgOverallRating}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Survey aggregates incorrect');
      testsFailed++;
    }

    // ============================================================================
    // TEST 10: Update program with survey aggregates
    // ============================================================================
    console.log('\n📈 TEST 10: Update program with survey aggregates');
    await db.updateProgramSurveyAggregates(programId);
    const updatedProgram = await db.getMliOpsProgramById(programId);

    if (updatedProgram.avg_content_rating === 4.5) {
      console.log('✅ PASS: Program updated with survey aggregates');
      console.log(`   Program avg_content_rating: ${updatedProgram.avg_content_rating}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Program survey aggregates not updated');
      testsFailed++;
    }

    // ============================================================================
    // Clean up
    // ============================================================================
    console.log('\n🧹 Cleaning up test data...');
    await db.clearMliOpsPrograms();
    console.log('✅ Test data cleaned up successfully');

  } catch (error) {
    console.error('\n❌ ERROR during testing:', error);
    testsFailed++;
  } finally {
    await db.close();
  }

  // ============================================================================
  // TEST SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📝 Total:  ${testsPassed + testsFailed}`);
  console.log('='.repeat(60));

  if (testsFailed === 0) {
    console.log('\n🎉 All relational table tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the errors above.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
