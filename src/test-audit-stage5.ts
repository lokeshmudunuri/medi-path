import { serverDb } from './server/serverDb';
import { onlineServerAPI } from './server/api';

async function runAuditTests() {
  console.log('=== RUNNING MEDIPATH PART A AUDIT REGRESSION TESTS ===\n');

  // Test 1: Past-slot blocking on current day
  console.log('[Test 1] Past-slot blocking on current day...');
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const availToday = await onlineServerAPI.getAvailability('doc-1', todayStr);
  const slotsToday = availToday.slots;
  
  // Find any slot that has an hour < current hour
  const currentHour = now.getHours();
  const pastSlots = slotsToday.filter(s => {
    let [time, modifier] = s.time.split(' ');
    let [h] = time.split(':').map(Number);
    if (modifier === 'PM' && h < 12) h += 12;
    if (modifier === 'AM' && h === 12) h = 0;
    return h < currentHour;
  });

  if (pastSlots.length > 0) {
    const allPastDisabled = pastSlots.every(s => s.available === false);
    if (!allPastDisabled) {
      throw new Error(`FAIL: Some past slots were marked available: ${JSON.stringify(pastSlots.filter(s => s.available))}`);
    }
    // Try to force-book a past slot
    const targetPast = pastSlots[0];
    try {
      await serverDb.createBooking({
        doctorId: 'doc-1',
        date: todayStr,
        slotId: targetPast.id,
        patientName: 'Lokesh Test',
        patientPhone: '9876543210',
        paymentMethod: 'UPI'
      });
      throw new Error(`FAIL: Server allowed booking of a past slot: ${targetPast.time}`);
    } catch (e: any) {
      if (e.message.startsWith('FAIL')) throw e;
      console.log(`  ✓ Successfully identified ${pastSlots.length} past slots, all marked unavailable and rejected on booking attempt: "${e.message}"`);
    }
  } else {
    console.log(`  ✓ Current time is before doctor morning slots, no past slots to test for today.`);
  }

  // Test 2: Server-side validation of phone & name
  console.log('\n[Test 2] Server-side patient validation (phone & name)...');
  const futureDate = '2026-10-15';
  const availFuture = await onlineServerAPI.getAvailability('doc-1', futureDate);
  const futureSlots = availFuture.slots;
  const testSlot = futureSlots.find(s => s.available);
  if (!testSlot) throw new Error('No available slot on future date');

  // Invalid phone test
  try {
    await serverDb.createBooking({
      doctorId: 'doc-1',
      date: futureDate,
      slotId: testSlot.id,
      patientName: 'Valid Name',
      patientPhone: '123',
      paymentMethod: 'UPI'
    });
    throw new Error('FAIL: Server accepted invalid 3-digit phone');
  } catch (e: any) {
    if (e.message.startsWith('FAIL')) throw e;
    console.log(`  ✓ Invalid phone rejected: "${e.message}"`);
  }

  // Invalid name test
  try {
    await serverDb.createBooking({
      doctorId: 'doc-1',
      date: futureDate,
      slotId: testSlot.id,
      patientName: ' ',
      patientPhone: '9876543210',
      paymentMethod: 'UPI'
    });
    throw new Error('FAIL: Server accepted blank patient name');
  } catch (e: any) {
    if (e.message.startsWith('FAIL')) throw e;
    console.log(`  ✓ Blank patient name rejected: "${e.message}"`);
  }

  // Test 3: Atomic double-booking concurrency protection
  console.log('\n[Test 3] Double-booking concurrency prevention...');
  const concurrentSlot = futureSlots.find(s => s.id !== testSlot.id && s.available);
  if (!concurrentSlot) throw new Error('No second slot available');

  const [resA, resB] = await Promise.allSettled([
    onlineServerAPI.createAppointment({
      doctorId: 'doc-1',
      date: futureDate,
      slotId: concurrentSlot.id,
      patientName: 'User A',
      patientPhone: '9876543210',
      paymentMethod: 'UPI'
    }),
    onlineServerAPI.createAppointment({
      doctorId: 'doc-1',
      date: futureDate,
      slotId: concurrentSlot.id,
      patientName: 'User B',
      patientPhone: '9876543211',
      paymentMethod: 'UPI'
    })
  ]);

  const successes = [resA, resB].filter(r => r.status === 'fulfilled').length;
  const failures = [resA, resB].filter(r => r.status === 'rejected').length;
  if (successes !== 1 || failures !== 1) {
    throw new Error(`FAIL: Expected exactly 1 success and 1 failure for concurrent booking. Successes: ${successes}, Failures: ${failures}`);
  }
  const rejectionReason = (resA.status === 'rejected' ? (resA as PromiseRejectedResult).reason : (resB as PromiseRejectedResult).reason)?.message;
  console.log(`  ✓ Concurrency test passed: 1 succeeded, 1 safely rejected with "${rejectionReason}"`);

  // Test 4: Payment Failure state integrity
  console.log('\n[Test 4] Payment Failure & Confirmation State...');
  const validBooking = resA.status === 'fulfilled' ? (resA as PromiseFulfilledResult<any>).value : (resB as PromiseFulfilledResult<any>).value;
  const failPayment = await onlineServerAPI.processMockPayment({
    appointmentId: validBooking.id,
    paymentMethod: 'Card',
    amount: 800,
    shouldFail: true
  });
  if (failPayment.status === 'SUCCESS') throw new Error('FAIL: Simulated failure resulted in success');
  
  const updatedApt = await onlineServerAPI.getAppointment(validBooking.id);
  if (updatedApt?.paymentStatus !== 'FAILED') {
    throw new Error(`FAIL: Expected paymentStatus to be FAILED, got ${updatedApt?.paymentStatus}`);
  }
  if (updatedApt?.status !== 'PAYMENT_FAILED') {
    throw new Error(`FAIL: Status should be PAYMENT_FAILED on failed payment, got ${updatedApt?.status}`);
  }
  console.log(`  ✓ Payment failure marks appointment status as PAYMENT_FAILED and paymentStatus as FAILED.`);

  console.log('\n=== ALL AUDIT REGRESSION TESTS PASSED ===');
}

runAuditTests().catch(err => {
  console.error(err);
});
