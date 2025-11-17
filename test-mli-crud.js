#!/usr/bin/env node

/**
 * MLI Operations CRUD Test Script
 * Tests all CRUD operations for MLI programs to ensure the schema migration was successful
 */

const DatabaseService = require('./databaseService');

async function runTests() {
  console.log('🧪 Starting MLI Operations CRUD Tests\n');

  const db = new DatabaseService('./data/proxy_server.db');
  await db.initialize();

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // ============================================================================
    // TEST 1: Create a program
    // ============================================================================
    console.log('📝 TEST 1: Create a new program');
    const programData = {
      program: 'Test Program 1',
      number_of_participants: 25,
      male_participants: 15,
      female_participants: 10,
      cash_revenue: 50000,
      non_monetary_revenue: 10000,
      participant_fee: 2000,
      program_cost: 30000,
      status: 'completed',
      start_date: '2025-01-15',
      end_date: '2025-01-20',
      notes: 'Test program for CRUD validation'
    };

    const programId = await db.upsertMliOpsProgram(programData);
    if (programId) {
      console.log(`✅ PASS: Created program with ID ${programId}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Could not create program');
      testsFailed++;
    }

    // ============================================================================
    // TEST 2: Read the program
    // ============================================================================
    console.log('\n📖 TEST 2: Read the created program');
    const program = await db.getMliOpsProgramById(programId);

    if (program && program.program === 'Test Program 1') {
      console.log('✅ PASS: Successfully read program');
      console.log(`   Program: ${program.program}`);
      console.log(`   Participants: ${program.number_of_participants} (M: ${program.male_participants}, F: ${program.female_participants})`);
      console.log(`   Cash Revenue: ${program.cash_revenue}`);
      console.log(`   Total Revenue: ${program.total_revenue}`);
      console.log(`   Program Cost: ${program.program_cost}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Could not read program or data mismatch');
      testsFailed++;
    }

    // ============================================================================
    // TEST 3: Verify cash_revenue field works
    // ============================================================================
    console.log('\n💰 TEST 3: Verify cash_revenue field');
    if (program.cash_revenue === 50000) {
      console.log('✅ PASS: cash_revenue field is working correctly');
      testsPassed++;
    } else {
      console.log(`❌ FAIL: cash_revenue expected 50000, got ${program.cash_revenue}`);
      testsFailed++;
    }

    // ============================================================================
    // TEST 4: Verify total_revenue calculation
    // ============================================================================
    console.log('\n🧮 TEST 4: Verify total_revenue calculation');
    const expectedTotal = 60000; // 50000 cash + 10000 non-monetary
    if (program.total_revenue === expectedTotal) {
      console.log('✅ PASS: total_revenue calculated correctly (60000)');
      testsPassed++;
    } else {
      console.log(`❌ FAIL: total_revenue expected ${expectedTotal}, got ${program.total_revenue}`);
      testsFailed++;
    }

    // ============================================================================
    // TEST 5: Update the program
    // ============================================================================
    console.log('\n✏️  TEST 5: Update program data');
    const updatedData = {
      id: programId,
      program: 'Test Program 1',
      number_of_participants: 30,
      male_participants: 18,
      female_participants: 12,
      cash_revenue: 60000,
      non_monetary_revenue: 15000,
      participant_fee: 2000,
      program_cost: 35000,
      status: 'completed',
      start_date: '2025-01-15',
      end_date: '2025-01-20',
      notes: 'Updated test program'
    };

    await db.upsertMliOpsProgram(updatedData);
    const updatedProgram = await db.getMliOpsProgramById(programId);

    if (updatedProgram.number_of_participants === 30 && updatedProgram.cash_revenue === 60000) {
      console.log('✅ PASS: Program updated successfully');
      console.log(`   New Participants: ${updatedProgram.number_of_participants}`);
      console.log(`   New Cash Revenue: ${updatedProgram.cash_revenue}`);
      console.log(`   New Total Revenue: ${updatedProgram.total_revenue}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Program update failed');
      testsFailed++;
    }

    // ============================================================================
    // TEST 6: Create program with backward compatibility (old field names)
    // ============================================================================
    console.log('\n🔄 TEST 6: Backward compatibility with old field names');
    const legacyData = {
      program: 'Legacy Test Program',
      number_of_participants: 20,
      male: 12,  // Old field name
      female: 8,  // Old field name
      total_revenue_input: 40000,  // Old field name for cash_revenue
      non_monetary_revenue: 5000,
      program_cost: 25000,
      status: 'planned',
      start_date: '2025-02-01',
      end_date: '2025-02-05'
    };

    const legacyId = await db.upsertMliOpsProgram(legacyData);
    const legacyProgram = await db.getMliOpsProgramById(legacyId);

    if (legacyProgram.male_participants === 12 &&
        legacyProgram.female_participants === 8 &&
        legacyProgram.cash_revenue === 40000) {
      console.log('✅ PASS: Backward compatibility working');
      console.log(`   Old 'male' → male_participants: ${legacyProgram.male_participants}`);
      console.log(`   Old 'female' → female_participants: ${legacyProgram.female_participants}`);
      console.log(`   Old 'total_revenue_input' → cash_revenue: ${legacyProgram.cash_revenue}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Backward compatibility failed');
      testsFailed++;
    }

    // ============================================================================
    // TEST 7: List all programs
    // ============================================================================
    console.log('\n📋 TEST 7: List all programs');
    const allPrograms = await db.getAllMliOpsPrograms();

    if (allPrograms.length === 2) {
      console.log('✅ PASS: Listed all programs successfully');
      console.log(`   Found ${allPrograms.length} programs`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL: Expected 2 programs, found ${allPrograms.length}`);
      testsFailed++;
    }

    // ============================================================================
    // TEST 8: Delete a program
    // ============================================================================
    console.log('\n🗑️  TEST 8: Delete a program');
    const deleted = await db.deleteMliOpsProgram(legacyId);
    const remainingPrograms = await db.getAllMliOpsPrograms();

    if (deleted && remainingPrograms.length === 1) {
      console.log('✅ PASS: Program deleted successfully');
      console.log(`   Remaining programs: ${remainingPrograms.length}`);
      testsPassed++;
    } else {
      console.log('❌ FAIL: Program deletion failed');
      testsFailed++;
    }

    // ============================================================================
    // TEST 9: Clean up test data
    // ============================================================================
    console.log('\n🧹 Cleaning up test data...');
    await db.clearMliOpsPrograms();
    const finalCount = await db.getMliOpsProgramCount();

    if (finalCount === 0) {
      console.log('✅ Test data cleaned up successfully');
    }

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
    console.log('\n🎉 All tests passed! MLI Operations CRUD is working correctly.');
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
