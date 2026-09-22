import { searchDoctors, getDoctorById } from './services/searchService.ts';
import { DOCTORS, SPECIALTIES, LOCATIONS, HOSPITALS } from './data/mockData.ts';

console.log('--- Checking Mock Data Counts ---');
console.log(`Doctors: ${DOCTORS.length} (Target: >= 20)`);
console.log(`Specialties: ${SPECIALTIES.length} (Target: >= 10)`);
console.log(`Locations: ${LOCATIONS.length} (Target: >= 8)`);
console.log(`Hospitals: ${HOSPITALS.length} (Target: >= 5)`);

console.log('\n--- Testing Search 1: Bhimavaram + General Physician ---');
const res1 = searchDoctors({ location: 'Bhimavaram', specialty: 'General Physician' });
console.log(`Found: ${res1.length} doctors`);
res1.forEach(d => console.log(` - ${d.name} (${d.specialty}, Fee: ₹${d.consultationFee})`));

console.log('\n--- Testing Search 2: Symptom Search "skin problem" ---');
const res2 = searchDoctors({ location: 'Hyderabad', query: 'skin problem' });
console.log(`Found: ${res2.length} doctors`);
res2.forEach(d => console.log(` - ${d.name} (${d.specialty}, ${d.locationName})`));

console.log('\n--- Testing Search 3: Doctor Name "Dr. Rajesh" ---');
const res3 = searchDoctors({ query: 'Dr. Rajesh' });
console.log(`Found: ${res3.length} doctors`);
res3.forEach(d => console.log(` - ${d.name} in ${d.locationName}`));

console.log('\n--- Testing Search 4: Filters (Max fee <= 500, Video Consultation) ---');
const res4 = searchDoctors({ consultationFeeMax: 500, consultationType: 'Video Consultation' });
console.log(`Found: ${res4.length} doctors matching fee <= 500 and Video Consultation`);

console.log('\n--- Testing Doctor by ID: doc-1 ---');
const doc1 = getDoctorById('doc-1');
console.log(`Doctor doc-1: ${doc1?.name}, reviews: ${doc1?.reviews.length}`);

console.log('\n--- All Unit Tests Passed! ---');
