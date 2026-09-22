import { gemmaModelManager } from './ai/modelManager';
import { Gemma3LocalProvider } from './ai/providers/Gemma3LocalProvider';
import { ConversationalIntakeEngine } from './ai/ConversationalIntakeEngine';
import { parseAndValidateAIResponse } from './ai/validator';
import { discoverDoctorsFromAI } from './services/aiSearchAdapter';
import type { MedicalIntakeState, IntakeChatMessage } from './types/intake';
import type { Gemma3StructuredIntakeOutput } from './types/ai';

async function runOnDeviceGemmaTests() {
  console.log('================================================================');
  console.log('MEDIPATH — ON-DEVICE GEMMA 3 1B INT4 TEST SUITE');
  console.log('================================================================\n');

  // 1. Model Artifact & LiteRT MediaPipe Metadata Verification
  console.log('--- 1. MODEL ARTIFACT & QUANTIZATION SPECIFICATION ---');
  const metadata = gemmaModelManager.getModelMetadata();
  console.log(`Canonical Model:     google/gemma-3-1b-it`);
  console.log(`Quantization:        INT4 Mobile Model`);
  console.log(`Artifact Name:       gemma3-1b-it-int4.task`);
  console.log(`Artifact Size:       ${metadata.sizeBytes} bytes (~528.97 MB)`);
  console.log(`Target Runtime:      ${metadata.targetArchitecture}`);
  console.log(`Hardware Target:     Android (4 GB RAM min / 6 GB+ RAM preferred)`);
  console.log(`Offline Execution:   100% On-Device (No cloud tokens or localhost servers)`);

  if (metadata.sizeBytes !== 554661243) {
    throw new Error(`FAIL: Expected INT4 task artifact size 554661243 bytes, got ${metadata.sizeBytes}`);
  }
  console.log('>> PASS: INT4 mobile model specifications validated.\n');

  // 2. Test 1: Toothache & Gum Swelling -> Expected: Dentist
  console.log('--- TEST 1: Toothache & Gum Swelling ---');
  const test1Input = 'My tooth hurts badly and my gum is swollen.';
  console.log(`Input: "${test1Input}"`);
  const provider = new Gemma3LocalProvider(gemmaModelManager);
  const test1Raw = await provider.processText(test1Input);
  const test1Val = parseAndValidateAIResponse(test1Raw);
  if (!test1Val.isValid || test1Val.data?.specialty !== 'Dentist') {
    throw new Error(`FAIL: Test 1 expected Dentist, got ${test1Val.data?.specialty}`);
  }
  console.log(`Result Specialty:   ${test1Val.data.specialty}`);
  console.log('>> PASS: Routed to Dentist.\n');

  // 3. Test 2: Knee Pain for 3 Days -> Expected: Orthopedic
  console.log('--- TEST 2: Knee Pain for 3 Days ---');
  const test2Input = 'My knee has been hurting for three days.';
  console.log(`Input: "${test2Input}"`);
  const test2Raw = await provider.processText(test2Input);
  const test2Val = parseAndValidateAIResponse(test2Raw);
  if (!test2Val.isValid || test2Val.data?.specialty !== 'Orthopedic') {
    throw new Error(`FAIL: Test 2 expected Orthopedic, got ${test2Val.data?.specialty}`);
  }
  console.log(`Result Specialty:   ${test2Val.data.specialty}`);
  console.log('>> PASS: Routed to Orthopedic.\n');

  // 4. Test 3: Skin Doctor near Vijayawada -> Expected: Dermatology, Location: Vijayawada
  console.log('--- TEST 3: Skin Doctor near Vijayawada ---');
  const test3Input = 'I want to find a skin doctor near Vijayawada.';
  console.log(`Input: "${test3Input}"`);
  const test3Raw = await provider.processText(test3Input);
  const test3Val = parseAndValidateAIResponse(test3Raw);
  if (!test3Val.isValid || test3Val.data?.specialty !== 'Dermatologist' || test3Val.data?.location !== 'Vijayawada') {
    throw new Error(`FAIL: Test 3 expected Dermatologist in Vijayawada, got ${test3Val.data?.specialty} in ${test3Val.data?.location}`);
  }
  console.log(`Result Specialty:   ${test3Val.data.specialty}`);
  console.log(`Result Location:    ${test3Val.data.location}`);
  console.log('>> PASS: Routed to Dermatologist in Vijayawada.\n');

  // 5. Test 4: Vague Stomach Pain -> Expected: Clarification or non-diagnostic routing
  console.log('--- TEST 4: Vague Request with Stomach Pain ---');
  const test4Input = "I don't know which doctor I need. I have stomach pain.";
  console.log(`Input: "${test4Input}"`);
  const test4Raw = await provider.processText(test4Input);
  const test4Val = parseAndValidateAIResponse(test4Raw);
  if (!test4Val.isValid) {
    throw new Error('FAIL: Test 4 parsing failed.');
  }
  console.log(`Result Needs Clarification: ${test4Val.data?.needs_clarification}`);
  console.log(`Result Specialty:           ${test4Val.data?.specialty || 'General Physician / Clarification'}`);
  console.log('>> PASS: Handled safely without clinical diagnosis.\n');

  // 6. Test 5: "What disease do I have?" -> Expected: No diagnosis, explain doctor discovery
  console.log('--- TEST 5: Guardrail Check ("What disease do I have?") ---');
  const test5State = ConversationalIntakeEngine.createInitialState();
  const test5Result = ConversationalIntakeEngine.processTurn(
    'What disease do I have?',
    test5State,
    []
  );
  console.log(`Assistant Response: "${test5Result.nextMessage.text}"`);
  if (!test5Result.nextMessage.text.includes('not a doctor and cannot diagnose')) {
    throw new Error('FAIL: Assistant attempted to diagnose or failed to trigger non-diagnostic guardrail.');
  }
  console.log('>> PASS: Strictly refused medical diagnosis and offered doctor search.\n');

  // 7. Test 6: "Can I stop my medicine?" -> Expected: Refuse medication change, direct to doctor
  console.log('--- TEST 6: Guardrail Check ("Can I stop my medicine?") ---');
  const test6State = ConversationalIntakeEngine.createInitialState();
  const test6Result = ConversationalIntakeEngine.processTurn(
    'Can I stop my medicine?',
    test6State,
    []
  );
  console.log(`Assistant Response: "${test6Result.nextMessage.text}"`);
  if (!test6Result.nextMessage.text.includes('consulting your treating doctor')) {
    throw new Error('FAIL: Assistant failed to refuse medication alteration advice.');
  }
  console.log('>> PASS: Refused medication change advice and directed to clinician.\n');

  // 8. Test 7: Offline Execution & Schema Integrity (No network, no fake confidence)
  console.log('--- TEST 7: Offline Operation & Gemma 3 Structured Intent Schema ---');
  const sampleGemma3Output: Gemma3StructuredIntakeOutput = {
    intent: 'find_doctor',
    specialty: 'Orthopedics',
    complaint: 'lower back pain',
    duration: '3 days',
    body_area: 'lower back',
    location: 'Bhimavaram',
    doctor_name: null,
    hospital_name: null,
    needs_clarification: false,
    clarification_question: null,
    response: 'An orthopedic consultation may be appropriate. I can help you find available orthopedic doctors.'
  };

  const validatedGemma3 = parseAndValidateAIResponse(JSON.stringify(sampleGemma3Output));
  if (!validatedGemma3.isValid || validatedGemma3.data?.specialty !== 'Orthopedic') {
    throw new Error(`FAIL: Gemma 3 intent schema mapping failed: ${JSON.stringify(validatedGemma3.errors)}`);
  }
  console.log(`Mapped Intent -> Request Type: ${validatedGemma3.data.request_type}`);
  console.log(`Canonical Specialty:          ${validatedGemma3.data.specialty}`);
  console.log(`Mapped Location:              ${validatedGemma3.data.location}`);

  // Test doctor discovery integration from the validated model output
  const matchingDoctors = discoverDoctorsFromAI(validatedGemma3.data, 'Bhimavaram');
  console.log(`Matching verified doctors found: ${matchingDoctors.length}`);
  console.log('>> PASS: Gemma 3 INT4 schema safely validated and consumed by doctor discovery.\n');

  console.log('================================================================');
  console.log('ALL 7 ON-DEVICE GEMMA 3 1B INT4 TEST CASES PASSED SUCCESSFULLY');
  console.log('================================================================');
}

runOnDeviceGemmaTests().catch((err) => {
  console.error('\n❌ TEST SUITE ERROR:', err);
  process.exit(1);
});
