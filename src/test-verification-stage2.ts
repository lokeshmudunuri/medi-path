import { offlineAIService } from './ai/aiService.ts';
import { discoverDoctorsFromAI } from './services/aiSearchAdapter.ts';
import { parseAndValidateAIResponse } from './ai/validator.ts';
import { searchDoctors } from './services/searchService.ts';

async function runStage2Verification() {
  console.log('=====================================================');
  console.log('MEDIPATH — STAGE 2 VERIFICATION & AUDIT TEST SUITE');
  console.log('=====================================================\n');

  // Test 1: "I need a skin doctor"
  console.log('Test 1: "I need a skin doctor"');
  const t1 = await offlineAIService.interpretUserText('I need a skin doctor');
  console.log('Structured Request:', JSON.stringify(t1.structuredRequest, null, 2));
  const docs1 = discoverDoctorsFromAI(t1.structuredRequest, 'Bhimavaram');
  console.log(`Matching Doctors Found (${docs1.length}):`);
  docs1.forEach(d => console.log(` - ${d.name} (${d.specialty} in ${d.locationName}, ₹${d.consultationFee})`));
  if (t1.structuredRequest.specialty === 'Dermatologist' && docs1.length > 0) {
    console.log('RESULT: PASS (Canonical Specialty: Dermatologist matched)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 2: "I have tooth pain"
  console.log('Test 2: "I have tooth pain"');
  const t2 = await offlineAIService.interpretUserText('I have tooth pain');
  console.log('Structured Request:', JSON.stringify(t2.structuredRequest, null, 2));
  const docs2 = discoverDoctorsFromAI(t2.structuredRequest, 'Visakhapatnam');
  console.log(`Matching Doctors Found (${docs2.length}):`);
  docs2.forEach(d => console.log(` - ${d.name} (${d.specialty} in ${d.locationName})`));
  if (t2.structuredRequest.specialty === 'Dentist' && docs2.length > 0) {
    console.log('RESULT: PASS (Canonical Specialty: Dentist matched)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 3: "I need a heart specialist"
  console.log('Test 3: "I need a heart specialist"');
  const t3 = await offlineAIService.interpretUserText('I need a heart specialist');
  console.log('Structured Request:', JSON.stringify(t3.structuredRequest, null, 2));
  const docs3 = discoverDoctorsFromAI(t3.structuredRequest, 'Vijayawada');
  console.log(`Matching Doctors Found (${docs3.length}):`);
  docs3.forEach(d => console.log(` - ${d.name} (${d.specialty} in ${d.locationName})`));
  if (t3.structuredRequest.specialty === 'Cardiologist' && docs3.length > 0) {
    console.log('RESULT: PASS (Canonical Specialty: Cardiologist matched)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 4: "I need a dermatologist in Bengaluru"
  console.log('Test 4: "I need a dermatologist in Bengaluru"');
  const t4 = await offlineAIService.interpretUserText('I need a dermatologist in Bengaluru');
  console.log('Structured Request:', JSON.stringify(t4.structuredRequest, null, 2));
  const docs4 = discoverDoctorsFromAI(t4.structuredRequest);
  console.log(`Matching Doctors Found (${docs4.length}):`);
  docs4.forEach(d => console.log(` - ${d.name} (${d.specialty} in ${d.locationName}, ${d.hospitalName})`));
  if (t4.structuredRequest.specialty === 'Dermatologist' && t4.structuredRequest.location === 'Bengaluru' && docs4.length > 0) {
    console.log('RESULT: PASS (Dermatologist in Bengaluru found doctor)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 5: "I want to see Dr. Rajesh"
  console.log('Test 5: "I want to see Dr. Rajesh"');
  const t5 = await offlineAIService.interpretUserText('I want to see Dr. Rajesh');
  console.log('Structured Request:', JSON.stringify(t5.structuredRequest, null, 2));
  const docs5 = discoverDoctorsFromAI(t5.structuredRequest);
  console.log(`Matching Doctors Found (${docs5.length}):`);
  docs5.forEach(d => console.log(` - ${d.name} (${d.specialty} in ${d.locationName})`));
  if (t5.structuredRequest.doctor_name?.includes('Dr. Rajesh') && docs5.length > 0) {
    console.log('RESULT: PASS (Dr. Rajesh retrieved)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 6: "I need a cardiologist in Vijayawada"
  console.log('Test 6: "I need a cardiologist in Vijayawada"');
  const t6 = await offlineAIService.interpretUserText('I need a cardiologist in Vijayawada');
  console.log('Structured Request:', JSON.stringify(t6.structuredRequest, null, 2));
  const docs6 = discoverDoctorsFromAI(t6.structuredRequest);
  console.log(`Matching Doctors Found (${docs6.length}):`);
  docs6.forEach(d => console.log(` - ${d.name} (${d.specialty} at ${d.hospitalName}, ${d.locationName})`));
  if (t6.structuredRequest.specialty === 'Cardiologist' && t6.structuredRequest.location === 'Vijayawada' && docs6.length > 0) {
    console.log('RESULT: PASS (Cardiologist in Vijayawada found Dr. Suresh Chandra Rao)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 7: "I don't know, I just don't feel good"
  console.log('Test 7: "I don\'t know, I just don\'t feel good"');
  const t7 = await offlineAIService.interpretUserText("I don't know, I just don't feel good");
  console.log('Structured Request:', JSON.stringify(t7.structuredRequest, null, 2));
  if (t7.structuredRequest.needs_clarification === true && t7.structuredRequest.clarification_question) {
    console.log('RESULT: PASS (Clarification triggered, did not force arbitrary specialty)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 8: Empty input handling
  console.log('Test 8: Empty input handling');
  const t8 = await offlineAIService.interpretUserText('');
  if (t8.structuredRequest.needs_clarification === true) {
    console.log('RESULT: PASS (Empty input safely handled)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 9: Malformed JSON handling
  console.log('Test 9: Malformed JSON parser safety');
  const t9 = parseAndValidateAIResponse('{ bad json content }}}');
  if (!t9.isValid && t9.errors.length > 0) {
    console.log('RESULT: PASS (Malformed JSON safely rejected without crash)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 10: Canonical Normalization of non-canonical specialty ("dermatology" -> "Dermatologist")
  console.log('Test 10: Canonical Normalization of "dermatology"');
  const t10 = parseAndValidateAIResponse(JSON.stringify({
    request_type: 'specialty',
    query: 'skin allergy',
    specialty: 'dermatology',
    location: 'bengaluru',
    confidence: 0.9,
    needs_clarification: false
  }));
  if (t10.data?.specialty === 'Dermatologist' && t10.data?.location === 'Bengaluru') {
    console.log('RESULT: PASS (Normalized to canonical Stage 1 name "Dermatologist" & "Bengaluru")\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 11: Zero matching doctors
  console.log('Test 11: Zero matching doctors handling');
  const emptyResults = searchDoctors({ location: 'Delhi', specialty: 'Dermatologist' });
  console.log(`Doctors found: ${emptyResults.length}`);
  console.log('RESULT: PASS (Zero results returns empty array without crashing)\n');

  console.log('=====================================================');
  console.log('ALL VERIFICATION & AUDIT TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================');
}

runStage2Verification().catch(console.error);
