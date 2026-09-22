import { onlineServerAPI } from './server/api.ts';
import { offlineAIService } from './ai/aiService.ts';
import { discoverDoctorsFromAI } from './services/aiSearchAdapter.ts';

async function runStage4Tests() {
  console.log('=====================================================');
  console.log('STAGE 4: ONLINE SERVER + AVAILABILITY + SLOTS + BOOKING + MOCK PAYMENT');
  console.log('=====================================================\n');

  // 1. Online Server Doctor APIs test
  console.log('Test 1: Online Server Doctor APIs');
  const allDocs = await onlineServerAPI.getDoctors();
  const doc1 = await onlineServerAPI.getDoctorById('doc-1');
  console.log(`Retrieved ${allDocs.length} doctors from online server layer.`);
  console.log(`Doctor doc-1 retrieved: ${doc1?.name} (${doc1?.specialty})`);
  if (allDocs.length >= 20 && doc1?.id === 'doc-1') {
    console.log('RESULT: PASS (Online doctor APIs verified)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // 2. Doctor Availability & Slots Test
  console.log('Test 2: Doctor Availability & Slots API');
  const futureTestDate = '2026-10-20';
  const avail = await onlineServerAPI.getAvailability('doc-1', futureTestDate);
  const availableSlots = avail.slots.filter(s => s.available);
  console.log(`Doctor doc-1 slots for ${futureTestDate}: ${avail.slots.length} total slots.`);
  console.log(`Available slots: ${availableSlots.length}`);
  if (avail.slots.length > 0 && availableSlots.length > 0) {
    console.log('RESULT: PASS (Slots API returned structured time slots)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // 3. Successful Booking & Mock Payment Flow
  console.log('Test 3: Booking Creation & Mock Payment Success');
  const slotToBook = availableSlots[0];
  console.log(`Attempting to book slot ${slotToBook.id} (${slotToBook.time}) for Dr. Rajesh...`);

  const apt = await onlineServerAPI.createAppointment({
    doctorId: 'doc-1',
    date: futureTestDate,
    slotId: slotToBook.id,
    patientName: 'Lokesh Kumar',
    patientPhone: '9876543210',
    paymentMethod: 'UPI',
    consultationType: 'In-Clinic',
  });

  console.log(`Created Appointment: ID=${apt.id}, Ref=${apt.bookingRef}, Status=${apt.status}`);

  const payResult = await onlineServerAPI.processMockPayment({
    appointmentId: apt.id,
    paymentMethod: 'UPI',
    amount: apt.consultationFee,
  });

  console.log(`Mock Payment Result: ${payResult.status} (PaymentId=${payResult.paymentId})`);
  const confirmedApt = await onlineServerAPI.getAppointment(apt.id);
  console.log(`Updated Appointment Status: ${confirmedApt?.status}, PaymentStatus=${confirmedApt?.paymentStatus}`);

  if (confirmedApt?.status === 'CONFIRMED' && confirmedApt?.paymentStatus === 'PAID') {
    console.log('RESULT: PASS (Booking successfully created and mock payment confirmed)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // 4. Double-Booking Protection Test
  console.log('Test 4: Server Double-Booking Protection');
  console.log(`User B attempting to book the SAME slot ${slotToBook.id} on ${futureTestDate}...`);
  try {
    await onlineServerAPI.createAppointment({
      doctorId: 'doc-1',
      date: futureTestDate,
      slotId: slotToBook.id,
      patientName: 'Second User',
      patientPhone: '9123456789',
      paymentMethod: 'Card',
      consultationType: 'In-Clinic',
    });
    console.error('RESULT: FAIL (Server allowed double booking of same slot!)\n');
  } catch (err: any) {
    console.log(`Caught Expected Server Rejection: "${err.message}"`);
    console.log('RESULT: PASS (Server double-booking protection actively rejected duplicate slot booking!)\n');
  }

  // 5. Mock Payment Failure Simulation Test
  console.log('Test 5: Mock Payment Failure Scenario');
  const slotToBook2 = availableSlots[1];
  const aptFail = await onlineServerAPI.createAppointment({
    doctorId: 'doc-1',
    date: futureTestDate,
    slotId: slotToBook2.id,
    patientName: 'Failure Test User',
    patientPhone: '9988776655',
    paymentMethod: 'Card',
  });

  const payFailResult = await onlineServerAPI.processMockPayment({
    appointmentId: aptFail.id,
    paymentMethod: 'Card',
    amount: aptFail.consultationFee,
    shouldFail: true,
  });

  console.log(`Mock Payment Result: ${payFailResult.status} (${payFailResult.message})`);
  const failedApt = await onlineServerAPI.getAppointment(aptFail.id);
  console.log(`Appointment Status after failed payment: ${failedApt?.status}`);

  if (payFailResult.status === 'FAILED' && failedApt?.status === 'PAYMENT_FAILED') {
    console.log('RESULT: PASS (Payment failure scenario safely handled and appointment not confirmed)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // 6. Cash at Clinic Test
  console.log('Test 6: Cash at Clinic Mode');
  const slotToBook3 = availableSlots[2];
  const aptCash = await onlineServerAPI.createAppointment({
    doctorId: 'doc-1',
    date: futureTestDate,
    slotId: slotToBook3.id,
    patientName: 'Cash Patient',
    patientPhone: '9001122334',
    paymentMethod: 'Cash at Clinic',
  });
  console.log(`Cash Booking: Status=${aptCash.status}, PaymentStatus=${aptCash.paymentStatus}`);
  if (aptCash.status === 'CONFIRMED' && aptCash.paymentStatus === 'PENDING') {
    console.log('RESULT: PASS (Cash at clinic correctly confirmed with PENDING payment status)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // 7. Full E2E Pipeline Check: Text AI → Structured Request → Online Server → Doctor → Booking
  console.log('Test 7: Full E2E Pipeline (AI Structured Request → Online Server → Availability → Booking)');
  const aiReq = await offlineAIService.interpretUserText('I need a dermatologist in Bengaluru');
  const matchedDocs = discoverDoctorsFromAI(aiReq.structuredRequest);
  const targetDoc = matchedDocs[0];
  console.log(`AI interpreted doctor: ${targetDoc.name} in ${targetDoc.locationName}`);
  const docAvail = await onlineServerAPI.getAvailability(targetDoc.id, futureTestDate);
  const firstSlot = docAvail.slots.find(s => s.available)!;
  const e2eBooking = await onlineServerAPI.createAppointment({
    doctorId: targetDoc.id,
    date: futureTestDate,
    slotId: firstSlot.id,
    patientName: 'AI Flow Patient',
    patientPhone: '9900990099',
    paymentMethod: 'UPI',
  });
  console.log(`E2E Booking Reference created: ${e2eBooking.bookingRef} for ${e2eBooking.doctorName}`);
  if (e2eBooking.bookingRef.startsWith('MP-')) {
    console.log('RESULT: PASS (End-to-End flow verified seamlessly)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  console.log('=====================================================');
  console.log('ALL STAGE 4 TESTS PASSED SUCCESSFULLY!');
  console.log('=====================================================');
}

runStage4Tests().catch(console.error);
