/**
 * Doctor Registration & Portal Types
 */

export interface DoctorRegistrationPayload {
  fullName: string;
  registrationNumber: string; // State Medical Council Registration No.
  specialty: string;
  hospitalName: string;
  locationName: string;
  phone: string;
  email: string;
  experienceYears: number;
  consultationFee: number;
  profileBio?: string;
}

export interface RegisteredDoctor {
  id: string;
  fullName: string;
  registrationNumber: string;
  specialty: string;
  hospitalName: string;
  locationName: string;
  phone: string;
  email: string;
  experienceYears: number;
  consultationFee: number;
  profileBio: string;
  status: 'VERIFIED_DEMO' | 'PENDING';
  registeredAt: string;
}
