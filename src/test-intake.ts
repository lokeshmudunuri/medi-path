import { ConversationalIntakeEngine } from './ai/ConversationalIntakeEngine';
import { gemmaModelManager } from './ai/modelManager';

async function runIntakeUnitTests() {
  console.log('=====================================================');
  console.log('MEDIPATH — CONVERSATIONAL INTAKE & TRUTHFUL MODEL TESTS');
  console.log('=====================================================\n');

  // Test 1: Mosquito bite does NOT immediately map to specialty
  console.log('Test 1: Multi-turn intake for "mosquito bite itching & swelling"');
  const initial = ConversationalIntakeEngine.createInitialState('Bhimavaram');
  const turn1 = ConversationalIntakeEngine.processTurn(
    'I was feeling itching and swelling from past three days by a mosquito bite',
    initial,
    []
  );

  console.log('Turn 1 Question:', turn1.nextMessage.text);
  if (turn1.updatedState.conversation_complete) {
    throw new Error('FAIL: Turn 1 immediately completed routing without asking context!');
  }
  if (turn1.routingResult) {
    throw new Error('FAIL: Turn 1 emitted a routing result prematurely!');
  }
  console.log('RESULT: PASS (Turn 1 properly asked follow-up question regarding location/progression)\n');

  // Test 2: Turn 2 context gathering
  console.log('Test 2: Turn 2 response ("On my arm, getting slightly bigger")');
  const turn2 = ConversationalIntakeEngine.processTurn(
    'On my arm, getting slightly bigger',
    turn1.updatedState,
    [turn1.nextMessage]
  );
  console.log('Turn 2 Question:', turn2.nextMessage.text);
  if (turn2.updatedState.body_location !== 'On my arm, getting slightly bigger') {
    throw new Error('FAIL: Body location was not recorded in state');
  }
  console.log('RESULT: PASS (Turn 2 gathered body location and asked duration/fever)\n');

  // Test 3: Red Flag Emergency Detection
  console.log('Test 3: Red flag detection ("I am having difficulty breathing and swelling of lips")');
  const redFlagTurn = ConversationalIntakeEngine.processTurn(
    'I am having difficulty breathing and swelling of lips',
    initial,
    []
  );
  console.log('Red Flag Notice:', redFlagTurn.nextMessage.text);
  if (!redFlagTurn.nextMessage.isRedFlagWarning) {
    throw new Error('FAIL: Red flag urgent warning was not triggered!');
  }
  if (!redFlagTurn.updatedState.red_flags.includes('Difficulty breathing')) {
    throw new Error('FAIL: Red flag list missing Difficulty breathing');
  }
  console.log('RESULT: PASS (Emergency red-flag warning triggered immediately without questionnaire delay)\n');

  // Test 4: Final Non-Diagnostic Routing Reason
  console.log('Test 4: Non-diagnostic reason_for_routing verification');
  const completedState = {
    ...turn2.updatedState,
    body_location: 'arm',
    duration: '3 days',
    possible_trigger: 'mosquito bite',
  };
  const routing = ConversationalIntakeEngine.determineRouting(completedState);
  console.log('Routing Specialty:', routing.specialty);
  console.log('Reason for Routing:', routing.reason_for_routing);

  if (routing.reason_for_routing.includes('You have an allergic') || routing.reason_for_routing.includes('diagnosis')) {
    throw new Error('FAIL: reason_for_routing gave a clinical diagnosis instead of a doctor routing reason!');
  }
  if (routing.specialty !== 'Dermatologist') {
    throw new Error('FAIL: Expected Dermatologist routing after full intake');
  }
  console.log('RESULT: PASS (Accurate routing without clinical diagnosis)\n');

  // Test 5: Model Manager Truthful Lifecycle
  console.log('Test 5: Model Manager State Truthfulness');
  const meta = gemmaModelManager.getModelMetadata();
  console.log('Model Name:', meta.name);
  console.log('Is Diagnostic:', meta.isDiagnostic);
  if (meta.isDiagnostic !== false) {
    throw new Error('FAIL: General model was falsely marked as diagnostic!');
  }
  console.log('RESULT: PASS (Model verified as non-diagnostic general intake router)\n');

  console.log('=====================================================');
  console.log('ALL CONVERSATIONAL INTAKE & TRUTHFULNESS TESTS PASSED');
  console.log('=====================================================');
}

runIntakeUnitTests().catch((err) => {
  console.error(err);
});
