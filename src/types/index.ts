export interface Location {
  id: string;
  name: string;
  state: string;
  popularAreas?: string[];
}

export interface Specialty {
  id: string;
  name: string;
  description: string;
  iconName: string;
  symptoms: string[];
}

export interface Hospital {
  id: string;
  name: string;
  locationId: string;
  address: string;
  rating: number;
}

export type ConsultationType = 'In-Clinic' | 'Video Consultation';

export interface DoctorAvailability {
  days: string[];
  timing: string;
  nextAvailable: string; // e.g., "Today, 4:00 PM"
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  specialtyId: string;
  qualifications: string;
  experience: number; // in years
  hospitalId: string;
  hospitalName: string;
  locationId: string;
  locationName: string;
  locality: string;
  consultationFee: number;
  consultationTypes: ConsultationType[];
  rating: number;
  reviewCount: number;
  about: string;
  avatarUrl: string;
  gender: 'Male' | 'Female';
  availability: DoctorAvailability;
  services: string[];
  reviews: Review[];
}

export interface DoctorSearchParams {
  query?: string;
  specialty?: string;
  location?: string;
  experienceMin?: number;
  consultationFeeMax?: number;
  consultationType?: ConsultationType;
  gender?: 'Male' | 'Female';
  sortBy?: 'relevance' | 'experience' | 'fee-low' | 'fee-high' | 'rating';
}
