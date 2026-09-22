/**
 * Queue & Token OPD Architecture Data Models
 */

export type DoctorQueueStatus = 
  | 'AVAILABLE' 
  | 'WITH_PATIENT' 
  | 'BREAK' 
  | 'DELAYED' 
  | 'EMERGENCY' 
  | 'OFFLINE';

export type PatientQueueStatus = 
  | 'WAITING' 
  | 'ON_THE_WAY' 
  | 'IN_CONSULTATION' 
  | 'COMPLETED' 
  | 'NO_SHOW' 
  | 'WALK_IN' 
  | 'CANCELLED';

export interface PatientQueueEntry {
  queueId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  tokenNumber: number;
  joinedAt: string;
  status: PatientQueueStatus;
  estimatedArrivalTime: string; // e.g. "17:05"
  estimatedConsultationWindow: string; // e.g. "17:20–17:35"
  actualArrivalTime?: string;
  consultationStartedAt?: string;
  consultationEndedAt?: string;
}

export interface BreakPeriod {
  start: string; // e.g. "13:00"
  durationMinutes: number; // e.g. 30
  reason: string;
}

export interface QueueState {
  doctorId: string;
  doctorName: string;
  currentToken: number;
  nextToken: number;
  waitingTokens: number[];
  completedTokens: number[];
  averageConsultationMinutes: number;
  recentConsultationTimes: number[]; // in minutes, e.g. [7, 9, 6, 8]
  doctorStatus: DoctorQueueStatus;
  breakPeriods: BreakPeriod[];
  walkInCount: number;
  noShowCount: number;
  lastUpdated: string;
  patients: PatientQueueEntry[];
}

export interface QueuePredictionInput {
  doctorId: string;
  currentToken: number;
  patientToken: number;
  patientsAhead: number;
  recentConsultationTimes: number[];
  averageConsultationMinutes: number;
  doctorStatus: DoctorQueueStatus;
  expectedBreakMinutes?: number;
  noShowRate?: number; // e.g. 0.1 for 10%
  walkInCount?: number;
  currentTime?: Date;
}

export interface QueuePredictionOutput {
  estimatedWaitMinutes: number;
  minWaitMinutes: number;
  maxWaitMinutes: number;
  estimatedConsultationStart: string; // "5:18 PM–5:31 PM"
  recommendedArrivalTime: string; // "5:05 PM" (15 min buffer before window)
  tokenNumber: number;
  patientsAhead: number;
  confidence: number;
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedWindowStart?: Date;
  estimatedWindowEnd?: Date;
  recommendedArrivalDate?: Date;
}

export interface QueuePredictionProvider {
  id: string;
  name: string;
  predictWaitTime(input: QueuePredictionInput): QueuePredictionOutput;
}
