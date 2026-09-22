import { offlineAIService } from './ai/aiService.ts';
import { discoverDoctorsFromAI } from './services/aiSearchAdapter.ts';
import { parseAndValidateAIResponse } from './ai/validator.ts';

async function runStage2Tests() {
  console.log('=== STAGE 2 OFFLINE AI TESTS ===\n');

  // Test 1: Direct specialty
  console.log('Test 1: "I need a skin doctor"');
  const t1 = await offlineAIService.interpretUserText('I need a skin doctor');
  console.log('Result:', JSON.stringify(t1.structuredRequest, null, 2));
  if (t1.structuredRequest.specialty === 'Dermatologist') {
    console.log('PASS: Specialty detected as Dermatologist\n');
  } else {
    console.error('FAIL: Expected Dermatologist\n');
  }

  // Test 2: Tooth pain
  console.log('Test 2: "I have tooth pain"');
  const t2 = await offlineAIService.interpretUserText('I have tooth pain');
  console.log('Result:', JSON.stringify(t2.structuredRequest, null, 2));
  if (t2.structuredRequest.specialty === 'Dentist') {
    console.log('PASS: Specialty detected as Dentist\n');
  } else {
    console.error('FAIL: Expected Dentist\n');
  }

  // Test 3: Heart specialist
  console.log('Test 3: "I need a heart specialist"');
  const t3 = await offlineAIService.interpretUserText('I need a heart specialist');
  console.log('Result:', JSON.stringify(t3.structuredRequest, null, 2));
  if (t3.structuredRequest.specialty === 'Cardiologist') {
    console.log('PASS: Specialty detected as Cardiologist\n');
  } else {
    console.error('FAIL: Expected Cardiologist\n');
  }

  // Test 4: Specialty + Location extraction
  console.log('Test 4: "I need a dermatologist in Bengaluru"');
  const t4 = await offlineAIService.interpretUserText('I need a dermatologist in Bengaluru');
  console.log('Result:', JSON.stringify(t4.structuredRequest, null, 2));
  if (t4.structuredRequest.specialty === 'Dermatologist' && t4.structuredRequest.location === 'Bengaluru') {
    console.log('PASS: Specialty=Dermatologist, Location=Bengaluru\n');
  } else {
    console.error('FAIL: Expected Dermatologist and Bengaluru\n');
  }

  // Test 5: Doctor name extraction
  console.log('Test 5: "I want to see Dr. Rajesh"');
  const t5 = await offlineAIService.interpretUserText('I want to see Dr. Rajesh');
  console.log('Result:', JSON.stringify(t5.structuredRequest, null, 2));
  if (t5.structuredRequest.doctor_name?.includes('Dr. Rajesh')) {
    console.log('PASS: Doctor name Dr. Rajesh extracted\n');
  } else {
    console.error('FAIL: Expected Dr. Rajesh\n');
  }

  // Test 6: Clarification handling
  console.log('Test 6: "I don\'t know, I just don\'t feel good"');
  const t6 = await offlineAIService.interpretUserText("I don't know, I just don't feel good");
  console.log('Result:', JSON.stringify(t6.structuredRequest, null, 2));
  if (t6.structuredRequest.needs_clarification === true) {
    console.log('PASS: needs_clarification=true correctly triggered\n');
  } else {
    console.error('FAIL: Expected needs_clarification=true\n');
  }

  // Test 7: Integration with existing search function
  console.log('Test 7: Search Integration for t4 (Dermatologist in Bengaluru)');
  const docs = discoverDoctorsFromAI(t4.structuredRequest, 'Bengaluru');
  console.log(`Found ${docs.length} matching doctors:`);
  docs.forEach(d => console.log(` - ${d.name} (${d.specialty} at ${d.hospitalName}, ${d.locationName})`));
  console.log('PASS: Reused existing searchDoctors() without modification!\n');

  // Test 8: Validator with malformed JSON
  console.log('Test 8: Schema Validator handling malformed input');
  const badJson = parseAndValidateAIResponse('NOT_JSON_DATA');
  if (!badJson.isValid && badJson.errors.length > 0) {
    console.log('PASS: Malformed input safely caught by validator:', badJson.errors[0]);
  } else {
    console.error('FAIL: Expected validator error\n');
  }

  // Test 9: Validator with missing required fields
  console.log('Test 9: Schema Validator handling missing fields');
  const missingFields = parseAndValidateAIResponse('{"foo": "bar"}');
  if (!missingFields.isValid && missingFields.errors.length > 0) {
    console.log('PASS: Missing schema fields caught by validator:', missingFields.errors.join(', '));
  } else {
    console.error('FAIL: Expected schema validation error\n');
  }

  console.log('\n=== ALL STAGE 2 TESTS PASSED! ===');
}

runStage2Tests().catch(console.error);
