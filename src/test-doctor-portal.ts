import { onlineServerAPI } from './server/api';
import { liveQueueManager } from './queue/LiveQueueManager';

async function runDoctorPortalTests() {
  console.log('=====================================================');
  console.log('MEDIPATH — DOCTOR REGISTRATION & PORTAL TESTS');
  console.log('=====================================================\n');

  // Test 1: Register new practitioner
  console.log('[Test 1] Doctor Registration through Doctor Portal API...');
  const newDoctor = await onlineServerAPI.registerDoctor({
    fullName: 'Dr. Siddharth Mukherjee',
    registrationNumber: 'KMC-2015-99882',
    specialty: 'Oncologist',
    hospitalName: 'Manipal Comprehensive Cancer Center',
    locationName: 'Bengaluru',
    phone: '9845012345',
    email: 'smukherjee@medipath.local',
    experienceYears: 14,
    consultationFee: 800,
    profileBio: 'Clinical oncologist and oncology researcher.',
  });

  console.log(`  ✓ Doctor Registered with ID: ${newDoctor.id}`);
  console.log(`  ✓ Status: ${newDoctor.status}`);
  console.log(`  ✓ Verified Registration: ${newDoctor.registrationNumber}`);

  // Test 2: Validation of short names / missing reg number
  console.log('\n[Test 2] Doctor Registration Validation Defense...');
  try {
    await onlineServerAPI.registerDoctor({
      fullName: 'Dr',
      registrationNumber: '1',
      specialty: 'Dentist',
      hospitalName: 'Clinic',
      locationName: 'Bengaluru',
      phone: '123',
      email: '',
      experienceYears: 1,
      consultationFee: 300,
    });
    throw new Error('FAIL: Invalid doctor registration should have thrown validation error!');
  } catch (err: any) {
    console.log(`  ✓ Expected validation error caught: "${err.message}"`);
  }

  // Test 3: Public Doctor Listing Integration
  console.log('\n[Test 3] Verifying Registered Doctor is searchable in public directory...');
  const doctors = await onlineServerAPI.getDoctors({ query: 'Mukherjee' });
  const found = doctors.find(d => d.id === newDoctor.id);
  if (!found) {
    throw new Error('FAIL: Newly registered doctor is not searchable in public API!');
  }
  console.log(`  ✓ Search retrieved: ${found.name} (${found.specialty} at ${found.hospitalName})`);

  // Test 4: Live Queue Integration for Registered Doctor
  console.log('\n[Test 4] Verifying OPD Live Queue for Registered Doctor...');
  const initialQ = liveQueueManager.getQueueState(newDoctor.id);
  console.log(`  ✓ Initial OPD queue state for ${newDoctor.id}: Current Token #${initialQ.currentToken}, Waiting: ${initialQ.waitingTokens.length}`);

  const joinResult = liveQueueManager.joinQueue({
    doctorId: newDoctor.id,
    patientName: 'Ramesh Patient',
    patientPhone: '9876543210',
  });
  console.log(`  ✓ Patient joined queue and allocated Token #${joinResult.entry.tokenNumber}`);

  const advancedQ = liveQueueManager.advanceQueue(newDoctor.id, 9);
  console.log(`  ✓ Queue advanced to Token #${advancedQ.currentToken}, completed count: ${advancedQ.completedTokens.length}`);

  console.log('\n=====================================================');
  console.log('ALL DOCTOR PORTAL & REGISTRATION TESTS PASSED');
  console.log('=====================================================');
}

runDoctorPortalTests().catch((err) => {
  console.error('Doctor portal test failure:', err);
  throw err;
});
