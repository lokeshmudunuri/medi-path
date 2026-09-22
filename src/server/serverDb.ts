import { DOCTORS, HOSPITALS, LOCATIONS, SPECIALTIES } from '../data/mockData';
import type { Doctor, Hospital, Location, Specialty, DoctorSearchParams } from '../types/index';
import type { 
  Appointment, 
  DayAvailability, 
  TimeSlot, 
  CreateBookingPayload, 
  MockPaymentPayload, 
  MockPaymentResult 
} from '../types/booking';

/**
 * OnlineServerDatabase
 * 
 * In-memory authoritative online data store for MediPath.
 * - Stores confirmed bookings and enforces strict double-booking protection.
 * - Tracks slot availability per doctor per date.
 * - Processes mock payments and updates appointment status.
 */
class OnlineServerDatabase {
  private appointments: Map<string, Appointment> = new Map();
  // Key: `${doctorId}_${date}_${slotId}` -> appointmentId
  private bookedSlots: Map<string, string> = new Map();

  constructor() {
    // Pre-populate some existing booked slots to demonstrate real double-booking defense
    const today = new Date().toISOString().split('T')[0];
    this.bookedSlots.set(`doc-1_${today}_slot-m2`, 'pre-booked-sample');
  }

  public getDoctors(params?: DoctorSearchParams): Doctor[] {
    let results = [...DOCTORS];
    if (!params) return results;

    const { query, specialty, location, experienceMin, consultationFeeMax, consultationType, gender, sortBy } = params;

    if (location) {
      const locLower = location.toLowerCase();
      results = results.filter((d) => 
        d.locationName.toLowerCase() === locLower || d.locationName.toLowerCase().includes(locLower) ||
        d.locality.toLowerCase().includes(locLower)
      );
    }

    if (specialty) {
      const specLower = specialty.toLowerCase();
      results = results.filter((d) => 
        d.specialty.toLowerCase() === specLower || d.specialty.toLowerCase().includes(specLower)
      );
    }

    if (query) {
      const qLower = query.toLowerCase();
      results = results.filter((d) => 
        d.name.toLowerCase().includes(qLower) ||
        d.specialty.toLowerCase().includes(qLower) ||
        d.qualifications.toLowerCase().includes(qLower) ||
        d.hospitalName.toLowerCase().includes(qLower) ||
        d.services.some((s) => s.toLowerCase().includes(qLower))
      );
    }

    if (experienceMin !== undefined) {
      results = results.filter((d) => d.experience >= experienceMin);
    }

    if (consultationFeeMax !== undefined) {
      results = results.filter((d) => d.consultationFee <= consultationFeeMax);
    }

    if (consultationType) {
      results = results.filter((d) => d.consultationTypes.includes(consultationType));
    }

    if (gender) {
      results = results.filter((d) => d.gender === gender);
    }

    if (sortBy === 'rating') {
      results.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'experience') {
      results.sort((a, b) => b.experience - a.experience);
    } else if (sortBy === 'fee-low') {
      results.sort((a, b) => a.consultationFee - b.consultationFee);
    } else if (sortBy === 'fee-high') {
      results.sort((a, b) => b.consultationFee - a.consultationFee);
    }

    return results;
  }

  public getDoctorById(id: string): Doctor | undefined {
    return DOCTORS.find((d) => d.id === id);
  }

  public getHospitals(): Hospital[] {
    return HOSPITALS;
  }

  public getLocations(): Location[] {
    return LOCATIONS;
  }

  public getSpecialties(): Specialty[] {
    return SPECIALTIES;
  }

  /**
   * Generates standard daily slot schedule for a doctor and applies real-time booking locks
   */
  public getAvailability(doctorId: string, date: string): DayAvailability {
    const doctor = this.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error(`Doctor with ID ${doctorId} not found.`);
    }

    // Standard time slots across morning, afternoon, evening
    const baseSlots: Omit<TimeSlot, 'available'>[] = [
      { id: 'slot-m1', time: '09:30 AM', period: 'Morning' },
      { id: 'slot-m2', time: '10:00 AM', period: 'Morning' },
      { id: 'slot-m3', time: '10:30 AM', period: 'Morning' },
      { id: 'slot-m4', time: '11:00 AM', period: 'Morning' },
      { id: 'slot-m5', time: '11:30 AM', period: 'Morning' },
      { id: 'slot-a1', time: '01:00 PM', period: 'Afternoon' },
      { id: 'slot-a2', time: '02:00 PM', period: 'Afternoon' },
      { id: 'slot-a3', time: '03:00 PM', period: 'Afternoon' },
      { id: 'slot-e1', time: '05:00 PM', period: 'Evening' },
      { id: 'slot-e2', time: '05:30 PM', period: 'Evening' },
      { id: 'slot-e3', time: '06:00 PM', period: 'Evening' },
      { id: 'slot-e4', time: '06:30 PM', period: 'Evening' },
    ];

    // Check if the requested date is today
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = date === todayStr;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Helper to convert "10:30 AM" into minutes from midnight
    const timeToMinutes = (timeStr: string) => {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return 0;
      let hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const meridian = match[3].toUpperCase();
      if (meridian === 'PM' && hours !== 12) hours += 12;
      if (meridian === 'AM' && hours === 12) hours = 0;
      return hours * 60 + mins;
    };

    const slots: TimeSlot[] = baseSlots.map((slot) => {
      const slotKey = `${doctorId}_${date}_${slot.id}`;
      const isBooked = this.bookedSlots.has(slotKey);
      
      // If date is today and slot time has already passed, mark unavailable
      let isPast = false;
      if (isToday) {
        const slotMinutes = timeToMinutes(slot.time);
        if (slotMinutes <= currentMinutes) {
          isPast = true;
        }
      }

      return {
        ...slot,
        available: !isBooked && !isPast,
      };
    });

    return {
      doctorId,
      date,
      slots,
    };
  }

  /**
   * Authoritative Booking Verification and Creation
   */
  public createBooking(payload: CreateBookingPayload): Appointment {
    const { doctorId, date, slotId, patientName, patientPhone, patientEmail, paymentMethod, consultationType } = payload;

    // 1. Verify Doctor
    const doctor = this.getDoctorById(doctorId);
    if (!doctor) {
      throw new Error(`Doctor ${doctorId} does not exist on this server.`);
    }

    // 2. Validate Date
    if (!date || isNaN(new Date(date).getTime())) {
      throw new Error(`Invalid appointment date: ${date}`);
    }

    // 2b. Validate Patient Details
    if (!patientName || patientName.trim().length < 2) {
      throw new Error('Patient name must be at least 2 characters long.');
    }
    const cleanPhone = (patientPhone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      throw new Error('Please enter a valid 10-digit phone number.');
    }

    // 2c. Server-level Idempotency: Check if patient already has an active booking for this doctor on this date
    const existingActiveAppointment = Array.from(this.appointments.values()).find(
      (a) =>
        a.doctorId === doctorId &&
        a.date === date &&
        (a.patientPhone.replace(/\D/g, '') === cleanPhone) &&
        (a.status === 'CONFIRMED' || a.status === 'PENDING_PAYMENT')
    );
    if (existingActiveAppointment) {
      return existingActiveAppointment;
    }

    // 3. Check Slot existence and availability (including past-time validation)
    const availability = this.getAvailability(doctorId, date);
    const slot = availability.slots.find((s) => s.id === slotId);
    if (!slot) {
      throw new Error(`Slot ${slotId} is not a valid slot for doctor ${doctorId}.`);
    }

    if (!slot.available) {
      const slotKey = `${doctorId}_${date}_${slotId}`;
      if (this.bookedSlots.has(slotKey)) {
        throw new Error(`Slot "${slotId}" on ${date} is already booked. Please choose another slot.`);
      } else {
        throw new Error(`Slot "${slotId}" on ${date} is in the past or unavailable.`);
      }
    }

    // 4. Double-check slot key
    const slotKey = `${doctorId}_${date}_${slotId}`;
    if (this.bookedSlots.has(slotKey)) {
      throw new Error(`Slot "${slotId}" on ${date} is already booked. Please choose another slot.`);
    }

    // 5. Generate IDs
    const id = `apt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const randomRefNum = Math.floor(100000 + Math.random() * 900000);
    const bookingRef = `MP-${randomRefNum}`;

    const hospital = HOSPITALS.find((h) => h.id === doctor.hospitalId) || {
      name: doctor.hospitalName,
      address: `${doctor.locality}, ${doctor.locationName}`,
    };

    const isCash = paymentMethod === 'Cash at Clinic';

    // Assign Token Number if not provided
    const assignedToken = payload.tokenNumber || Math.floor(25 + Math.random() * 20);

    const appointment: Appointment = {
      id,
      bookingRef,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialty,
      hospitalId: doctor.hospitalId,
      hospitalName: doctor.hospitalName,
      hospitalAddress: hospital.address || `${doctor.locality}, ${doctor.locationName}`,
      locationName: doctor.locationName,
      patientName: patientName.trim(),
      patientPhone: patientPhone.trim(),
      patientEmail: patientEmail?.trim(),
      date,
      slotId,
      slotTime: slot.time,
      consultationFee: doctor.consultationFee,
      consultationType: consultationType || 'In-Clinic',
      status: isCash ? 'CONFIRMED' : 'PENDING_PAYMENT',
      paymentMethod,
      paymentStatus: isCash ? 'PENDING' : 'PENDING',
      createdAt: new Date().toISOString(),
      
      // Token & Queue Semantics
      tokenNumber: assignedToken,
      estimatedConsultationWindow: payload.estimatedConsultationWindow || `${slot.time}–${slot.time.replace(/:\d+/, ':45')}`,
      recommendedArrivalTime: payload.recommendedArrivalTime || '15 mins before time window',
      patientsAhead: Math.max(1, assignedToken - 20),
    };

    // Lock slot on server
    this.bookedSlots.set(slotKey, id);
    this.appointments.set(id, appointment);

    return appointment;
  }

  /**
   * Process Mock Payment
   */
  public processMockPayment(payload: MockPaymentPayload): MockPaymentResult {
    const { appointmentId, paymentMethod, amount, shouldFail } = payload;
    const appointment = this.appointments.get(appointmentId);

    if (!appointment) {
      throw new Error(`Appointment with ID ${appointmentId} was not found on server.`);
    }

    if (shouldFail) {
      appointment.status = 'PAYMENT_FAILED';
      appointment.paymentStatus = 'FAILED';
      return {
        paymentId: `fail-${Date.now()}`,
        status: 'FAILED',
        amount,
        message: 'Mock payment declined by bank simulator. Please try again.',
      };
    }

    // Success
    const paymentId = `mock-pay-${Date.now()}`;
    appointment.status = 'CONFIRMED';
    appointment.paymentStatus = paymentMethod === 'Cash at Clinic' ? 'PENDING' : 'PAID';
    appointment.paymentId = paymentId;
    appointment.paymentMethod = paymentMethod;

    return {
      paymentId,
      status: 'SUCCESS',
      amount,
      message: 'Demo payment approved successfully.',
    };
  }

  public getAppointmentById(id: string): Appointment | undefined {
    return this.appointments.get(id);
  }

  public getAppointmentByRef(ref: string): Appointment | undefined {
    for (const apt of this.appointments.values()) {
      if (apt.bookingRef.toUpperCase() === ref.toUpperCase()) {
        return apt;
      }
    }
    return undefined;
  }

  // Doctor Registration Portal Storage
  private registeredDoctors: Map<string, any> = new Map();

  public registerDoctor(payload: {
    fullName: string;
    registrationNumber: string;
    specialty: string;
    hospitalName: string;
    locationName: string;
    phone: string;
    email: string;
    experienceYears: number;
    consultationFee: number;
    profileBio?: string;
  }) {
    if (!payload.fullName || payload.fullName.trim().length < 3) {
      throw new Error('Full name must be at least 3 characters.');
    }
    if (!payload.registrationNumber || payload.registrationNumber.trim().length < 4) {
      throw new Error('Please enter a valid State Medical Council registration number.');
    }
    if (!payload.specialty) {
      throw new Error('Specialty is required.');
    }

    const docId = `reg-doc-${Date.now()}`;
    const newDoc = {
      id: docId,
      fullName: payload.fullName.trim(),
      registrationNumber: payload.registrationNumber.trim().toUpperCase(),
      specialty: payload.specialty,
      hospitalName: payload.hospitalName || 'Associated Medical Center',
      locationName: payload.locationName || 'Bengaluru',
      phone: payload.phone,
      email: payload.email,
      experienceYears: Number(payload.experienceYears) || 1,
      consultationFee: Number(payload.consultationFee) || 500,
      profileBio: payload.profileBio || 'Registered medical practitioner on MediPath network.',
      status: 'VERIFIED_DEMO',
      registeredAt: new Date().toISOString(),
    };

    this.registeredDoctors.set(docId, newDoc);

    // Also register into public doctor list so patient booking/queue works seamlessly
    const publicDoctor: Doctor = {
      id: docId,
      name: newDoc.fullName.startsWith('Dr.') ? newDoc.fullName : `Dr. ${newDoc.fullName}`,
      specialty: newDoc.specialty,
      specialtyId: newDoc.specialty.toLowerCase().replace(/\s+/g, '-'),
      qualifications: 'MBBS, MD',
      experience: newDoc.experienceYears,
      hospitalId: 'hosp-registered',
      hospitalName: newDoc.hospitalName,
      locationId: 'loc-reg',
      locationName: newDoc.locationName,
      locality: 'Central Clinic',
      consultationFee: newDoc.consultationFee,
      consultationTypes: ['In-Clinic', 'Video Consultation'],
      rating: 5.0,
      reviewCount: 1,
      about: newDoc.profileBio,
      avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=400',
      gender: 'Male',
      availability: {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        timing: '09:00 AM - 05:00 PM',
        nextAvailable: 'Today, OPD Queue Active',
      },
      services: ['General Consultation', 'Clinical Evaluation', 'Prescriptions'],
      reviews: [],
    };

    // Prepend to doctors list
    DOCTORS.unshift(publicDoctor);

    return newDoc;
  }

  public getRegisteredDoctorById(id: string) {
    return this.registeredDoctors.get(id);
  }
}

export const serverDb = new OnlineServerDatabase();
