const axios = require('axios');

const API_URL = 'http://localhost:3000';
const TOKEN = 'demo-token-12345';

const client = axios.create({
    baseURL: API_URL,
    headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
    },
    validateStatus: () => true // Don't throw on error status
});

async function runVerification() {
    console.log('Starting verification...');

    // 1. Create Program with Costs
    console.log('\n1. Creating Program with Costs...');
    const createRes = await client.post('/api/mli-ops/programs', {
        program: 'Cost Test Program ' + Date.now(),
        venue_cost: 100.50,
        catering_cost: 200.00,
        materials_cost: 50.00,
        start_date: '2025-01-01',
        end_date: '2025-01-05'
    });

    if (createRes.status !== 201) {
        console.error('Failed to create program:', createRes.data);
        process.exit(1);
    }

    const programId = createRes.data.data.id;
    console.log('Program created with ID:', programId);

    // Verify costs in response
    const p = createRes.data.data;
    if (p.venue_cost !== 100.5 || p.catering_cost !== 200 || p.materials_cost !== 50) {
        console.error('Mismatch in created costs:', p);
        process.exit(1);
    }
    console.log('Costs verified in create response.');

    // 2. Update Program Costs
    console.log('\n2. Updating Program Costs...');
    const updateRes = await client.put(`/api/mli-ops/programs/${programId}`, {
        venue_cost: 150.00
    });

    if (updateRes.status !== 200) {
        console.error('Failed to update program:', updateRes.data);
        process.exit(1);
    }

    const updatedP = updateRes.data.data;
    if (updatedP.venue_cost !== 150 || updatedP.catering_cost !== 200) {
        console.error('Mismatch in updated costs:', updatedP);
        process.exit(1);
    }
    console.log('Costs verified in update response.');

    // 3. Create Survey
    console.log('\n3. Creating Survey...');
    const surveyRes = await client.post(`/api/mli-ops/programs/${programId}/surveys`, {
        content_rating: 4,
        delivery_rating: 4,
        overall_rating: 4,
        respondent_type: 'participant'
    });

    if (surveyRes.status !== 201) {
        console.error('Failed to create survey:', surveyRes.data);
        process.exit(1);
    }
    const surveyId = surveyRes.data.data.id;
    console.log('Survey created with ID:', surveyId);

    // 4. Update Survey
    console.log('\n4. Updating Survey...');
    const updateSurveyRes = await client.put(`/api/mli-ops/surveys/${surveyId}`, {
        content_rating: 5,
        delivery_rating: 5,
        overall_rating: 5
    });

    if (updateSurveyRes.status !== 200) {
        console.error('Failed to update survey:', updateSurveyRes.data);
        process.exit(1);
    }

    const updatedS = updateSurveyRes.data.data;
    if (updatedS.content_rating !== 5 || updatedS.overall_rating !== 5) {
        console.error('Mismatch in updated survey:', updatedS);
        process.exit(1);
    }
    console.log('Survey update verified.');

    console.log('\nVerification Successful!');
}

runVerification().catch(err => {
    console.error('Verification failed:', err);
    process.exit(1);
});
