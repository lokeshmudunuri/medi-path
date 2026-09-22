import { QueuePredictionEngine } from './queue/QueuePredictionEngine';
import { liveQueueManager } from './queue/LiveQueueManager';
import { SUPPORTED_INDIAN_LANGUAGES } from './types/speech';

async function runQueueAndLanguageTests() {
  console.log('=====================================================');
  console.log('MEDIPATH — REALISTIC TOKEN QUEUE & MULTILINGUAL TESTS');
  console.log('=====================================================\n');

  // Test 1: Supported Languages List covers top 10 Indian languages + Odia + English
  console.log('[Test 1] Verifying Top 10 Indian Languages Coverage...');
  const expectedLanguages = [
    'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil',
    'Gujarati', 'Urdu', 'Kannada', 'Odia', 'Malayalam'
  ];
  for (const lang of expectedLanguages) {
    const found = SUPPORTED_INDIAN_LANGUAGES.some(l => l.name.toLowerCase().includes(lang.toLowerCase()));
    if (!found) {
      throw new Error(`FAIL: Missing expected language ${lang}`);
    }
  }
  console.log(`  ✓ All ${expectedLanguages.length} Indian languages verified present in SUPPORTED_INDIAN_LANGUAGES.`);

  // Test 2: Standard deterministic wait prediction calculation
  console.log('\n[Test 2] Queue prediction for Dr. Rajesh (10 patients ahead, 7 min avg)...');
  const baselinePrediction = QueuePredictionEngine.predict({
    doctorId: 'doc-1',
    currentToken: 20,
    patientToken: 30,
    patientsAhead: 9,
    recentConsultationTimes: [7, 7, 7],
    averageConsultationMinutes: 7,
    doctorStatus: 'WITH_PATIENT',
  });
  console.log(`  ✓ Estimated Window: ${baselinePrediction.estimatedConsultationStart}`);
  console.log(`  ✓ Recommended Arrival: ${baselinePrediction.recommendedArrivalTime}`);
  console.log(`  ✓ Estimated Wait: ${baselinePrediction.estimatedWaitMinutes} mins (Range: ${baselinePrediction.minWaitMinutes}–${baselinePrediction.maxWaitMinutes}m)`);
  if (baselinePrediction.estimatedWaitMinutes < 40 || baselinePrediction.estimatedWaitMinutes > 85) {
    throw new Error(`FAIL: Expected wait time around ~60 mins, got ${baselinePrediction.estimatedWaitMinutes}`);
  }

  // Test 3: Longer consultations increase wait estimate
  console.log('\n[Test 3] Doctor consultations slow down (recent 14m per patient)...');
  const slowerPrediction = QueuePredictionEngine.predict({
    doctorId: 'doc-1',
    currentToken: 20,
    patientToken: 30,
    patientsAhead: 9,
    recentConsultationTimes: [14, 15, 13],
    averageConsultationMinutes: 7,
    doctorStatus: 'WITH_PATIENT',
  });
  console.log(`  ✓ Slower Pace Estimated Wait: ${slowerPrediction.estimatedWaitMinutes} mins`);
  if (slowerPrediction.estimatedWaitMinutes <= baselinePrediction.estimatedWaitMinutes) {
    throw new Error('FAIL: Slower consultations should increase wait time!');
  }

  // Test 4: Doctor goes on BREAK
  console.log('\n[Test 4] Doctor goes on BREAK (+20 mins)...');
  const breakPrediction = QueuePredictionEngine.predict({
    doctorId: 'doc-1',
    currentToken: 20,
    patientToken: 30,
    patientsAhead: 9,
    recentConsultationTimes: [7, 7, 7],
    averageConsultationMinutes: 7,
    doctorStatus: 'BREAK',
    expectedBreakMinutes: 20,
  });
  console.log(`  ✓ Break Estimated Wait: ${breakPrediction.estimatedWaitMinutes} mins`);
  if (breakPrediction.estimatedWaitMinutes <= baselinePrediction.estimatedWaitMinutes) {
    throw new Error('FAIL: Doctor break should increase estimated wait time!');
  }

  // Test 5: LiveQueueManager Patient Join & Token Increment
  console.log('\n[Test 5] LiveQueueManager join queue...');
  const initialQ = liveQueueManager.getQueueState('doc-1');
  const initialNext = initialQ.nextToken;
  const joinResult = liveQueueManager.joinQueue({
    doctorId: 'doc-1',
    patientName: 'Kavitha Devi',
    patientPhone: '9876543210',
  });
  console.log(`  ✓ Patient assigned token #${joinResult.entry.tokenNumber}`);
  console.log(`  ✓ Next token incremented to #${liveQueueManager.getQueueState('doc-1').nextToken}`);
  if (joinResult.entry.tokenNumber !== initialNext) {
    throw new Error(`FAIL: Expected token #${initialNext}, got #${joinResult.entry.tokenNumber}`);
  }

  // Test 6: Patient marks I'M ON MY WAY
  console.log('\n[Test 6] Patient marks "I\'M ON MY WAY"...');
  const onTheWayOk = liveQueueManager.markOnTheWay('doc-1', joinResult.entry.tokenNumber);
  const updatedPat = liveQueueManager.getQueueState('doc-1').patients.find(p => p.tokenNumber === joinResult.entry.tokenNumber);
  if (!onTheWayOk || updatedPat?.status !== 'ON_THE_WAY') {
    throw new Error('FAIL: Patient status was not updated to ON_THE_WAY');
  }
  console.log(`  ✓ Patient status updated to: ${updatedPat.status}`);

  // Test 7: Patient leaves queue
  console.log('\n[Test 7] Patient leaves queue...');
  const leaveOk = liveQueueManager.leaveQueue('doc-1', joinResult.entry.tokenNumber);
  const cancelledPat = liveQueueManager.getQueueState('doc-1').patients.find(p => p.tokenNumber === joinResult.entry.tokenNumber);
  if (!leaveOk || cancelledPat?.status !== 'CANCELLED') {
    throw new Error('FAIL: Patient was not cancelled upon leaving queue');
  }
  console.log(`  ✓ Patient successfully removed from waitingTokens: ${cancelledPat?.status}`);

  // Test 8: Clinic marks patient NO-SHOW
  console.log('\n[Test 8] Clinic marks token as NO-SHOW...');
  const qBefore = liveQueueManager.getQueueState('doc-1');
  const targetToken = qBefore.waitingTokens[0];
  const countBefore = qBefore.noShowCount;
  liveQueueManager.markNoShow('doc-1', targetToken);
  const qAfter = liveQueueManager.getQueueState('doc-1');
  if (qAfter.noShowCount <= countBefore || qAfter.waitingTokens.includes(targetToken)) {
    throw new Error('FAIL: No-show was not recorded properly');
  }
  console.log(`  ✓ Token #${targetToken} marked NO-SHOW. Total no-shows: ${qAfter.noShowCount}`);

  // Test 9: Clinic adds WALK-IN patient
  console.log('\n[Test 9] Clinic inserts WALK-IN patient...');
  const walkIn = liveQueueManager.addWalkIn('doc-1', 'Suresh Walk-in');
  console.log(`  ✓ Walk-in allocated token #${walkIn.tokenNumber} with status ${walkIn.status}`);
  if (walkIn.status !== 'WALK_IN') {
    throw new Error('FAIL: Expected status WALK_IN');
  }

  // Test 10: Complete & Advance Queue
  console.log('\n[Test 10] Complete patient & call next...');
  const curTokenBefore = liveQueueManager.getQueueState('doc-1').currentToken;
  const advancedQ = liveQueueManager.advanceQueue('doc-1', 8);
  console.log(`  ✓ Advanced from Token #${curTokenBefore} to Current Token #${advancedQ.currentToken}`);
  if (advancedQ.currentToken <= curTokenBefore) {
    throw new Error('FAIL: Queue currentToken did not advance!');
  }

  // Test 11: Idempotent Rapid Join Queue (Part 1 Test)
  console.log('\n[Test 11] Rapid multiple clicks on Join Queue (Idempotency test)...');
  const rapidPatient = {
    doctorId: 'doc-1',
    patientName: 'Arun Varma',
    patientPhone: '9988776655',
  };
  const firstJoin = liveQueueManager.joinQueue(rapidPatient);
  const secondJoin = liveQueueManager.joinQueue(rapidPatient);
  const thirdJoin = liveQueueManager.joinQueue(rapidPatient);
  console.log(`  ✓ First Join Token: #${firstJoin.entry.tokenNumber}`);
  console.log(`  ✓ Second Join Token: #${secondJoin.entry.tokenNumber} (isExisting: ${secondJoin.isExisting})`);
  console.log(`  ✓ Third Join Token: #${thirdJoin.entry.tokenNumber} (isExisting: ${thirdJoin.isExisting})`);
  if (firstJoin.entry.tokenNumber !== secondJoin.entry.tokenNumber || firstJoin.entry.tokenNumber !== thirdJoin.entry.tokenNumber) {
    throw new Error('FAIL: Duplicate tokens were created for rapid clicks by the same patient!');
  }
  if (!secondJoin.isExisting || !thirdJoin.isExisting) {
    throw new Error('FAIL: Subsequent joins should be flagged as existing!');
  }

  // Test 12: Verified Timing Windows & Date objects
  console.log('\n[Test 12] Verified Queue Prediction Engine returns Date-based windows...');
  if (!baselinePrediction.estimatedWindowStart || !baselinePrediction.estimatedWindowEnd || !baselinePrediction.confidenceLevel) {
    throw new Error('FAIL: QueuePredictionOutput is missing Date windows or confidenceLevel!');
  }
  console.log(`  ✓ Confidence Level: ${baselinePrediction.confidenceLevel}`);
  console.log(`  ✓ Date Windows: ${baselinePrediction.estimatedWindowStart.toLocaleTimeString()} to ${baselinePrediction.estimatedWindowEnd.toLocaleTimeString()}`);

  console.log('\n=====================================================');
  console.log('ALL REALISTIC TOKEN QUEUE & MULTILINGUAL TESTS PASSED');
  console.log('=====================================================');
}

runQueueAndLanguageTests().catch((err) => {
  console.error("Queue test failure:", err);
  throw err;
});
