import { serverDb } from './serverDb';
import type { Doctor, Hospital, Location, Specialty, DoctorSearchParams } from '../types/index';
import type { 
  Appointment, 
  DayAvailability, 
  CreateBookingPayload, 
  MockPaymentPayload, 
  MockPaymentResult 
} from '../types/booking';

/**
 * OnlineServerAPI
 * 
 * Exposes clean asynchronous backend API contracts matching:
 * - GET /doctors
 * - GET /doctors/:id
 * - GET /hospitals
 * - GET /locations
 * - GET /availability?doctorId=:id&date=:date
 * - POST /appointments
 * - POST /payments/mock
 * - GET /appointments/:id
 */
export const onlineServerAPI = {
  /**
   * GET /doctors
   */
  async getDoctors(params?: DoctorSearchParams): Promise<Doctor[]> {
    // Simulate brief network latency for realistic UX
    await new Promise((r) => setTimeout(r, 60));
    return serverDb.getDoctors(params);
  },

  /**
   * GET /doctors/:id
   */
  async getDoctorById(id: string): Promise<Doctor | null> {
    await new Promise((r) => setTimeout(r, 40));
    const doc = serverDb.getDoctorById(id);
    return doc || null;
  },

  /**
   * Register new practitioner on Doctor Portal
   */
  async registerDoctor(payload: any): Promise<any> {
    await new Promise((r) => setTimeout(r, 80));
    return serverDb.registerDoctor(payload);
  },

  async getRegisteredDoctorById(id: string): Promise<any> {
    await new Promise((r) => setTimeout(r, 40));
    return serverDb.getRegisteredDoctorById(id);
  },

  /**
   * GET /hospitals
   */
  async getHospitals(): Promise<Hospital[]> {
    return serverDb.getHospitals();
  },

  /**
   * GET /locations
   */
  async getLocations(): Promise<Location[]> {
    return serverDb.getLocations();
  },

  /**
   * GET /specialties
   */
  async getSpecialties(): Promise<Specialty[]> {
    return serverDb.getSpecialties();
  },

  /**
   * GET /availability?doctorId=:id&date=:date
   */
  async getAvailability(doctorId: string, date: string): Promise<DayAvailability> {
    await new Promise((r) => setTimeout(r, 80));
    return serverDb.getAvailability(doctorId, date);
  },

  /**
   * POST /appointments
   */
  async createAppointment(payload: CreateBookingPayload): Promise<Appointment> {
    await new Promise((r) => setTimeout(r, 120));
    return serverDb.createBooking(payload);
  },

  /**
   * POST /payments/mock
   */
  async processMockPayment(payload: MockPaymentPayload): Promise<MockPaymentResult> {
    await new Promise((r) => setTimeout(r, 150));
    return serverDb.processMockPayment(payload);
  },

  /**
   * GET /appointments/:id
   */
  async getAppointment(id: string): Promise<Appointment | null> {
    await new Promise((r) => setTimeout(r, 50));
    return serverDb.getAppointmentById(id) || serverDb.getAppointmentByRef(id) || null;
  },
};
