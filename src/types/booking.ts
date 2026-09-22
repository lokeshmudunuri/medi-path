export interface TimeSlot {
  id: string;
  time: string; // e.g. "10:00 AM"
  period: 'Morning' | 'Afternoon' | 'Evening';
  available: boolean;
}

export interface DayAvailability {
  doctorId: string;
  date: string; // YYYY-MM-DD
  slots: TimeSlot[];
}

export type AppointmentStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'PAYMENT_FAILED' | 'CANCELLED';

export type PaymentMethod = 'UPI' | 'Card' | 'Cash at Clinic';

export interface Appointment {
  id: string;
  bookingRef: string; // e.g. MP-849201
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  locationName: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  date: string; // YYYY-MM-DD
  slotId: string;
  slotTime: string;
  consultationFee: number;
  consultationType: 'In-Clinic' | 'Video Consultation';
  status: AppointmentStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PAID' | 'PENDING' | 'FAILED';
  paymentId?: string;
  createdAt: string;
  
  // OPD Token & Queue Semantics
  tokenNumber?: number;
  estimatedConsultationWindow?: string; // e.g. "5:20–5:35 PM"
  recommendedArrivalTime?: string; // e.g. "5:05 PM"
  patientsAhead?: number;
}

export interface CreateBookingPayload {
  doctorId: string;
  date: string;
  slotId: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  paymentMethod: PaymentMethod;
  consultationType?: 'In-Clinic' | 'Video Consultation';
  
  // OPD Token & Queue Semantics
  tokenNumber?: number;
  estimatedConsultationWindow?: string;
  recommendedArrivalTime?: string;
}

export interface MockPaymentPayload {
  appointmentId: string;
  paymentMethod: PaymentMethod;
  amount: number;
  shouldFail?: boolean; // For testing payment failure scenario
}

export interface MockPaymentResult {
  paymentId: string;
  status: 'SUCCESS' | 'FAILED';
  amount: number;
  message: string;
}
