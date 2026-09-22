import type { 
  QueueState, 
  PatientQueueEntry, 
  DoctorQueueStatus, 
  QueuePredictionOutput 
} from '../types/queue';
import { QueuePredictionEngine } from './QueuePredictionEngine';
import { DOCTORS } from '../data/mockData';

/**
 * LiveQueueManager
 * 
 * In-memory authoritative manager for doctor OPD queues.
 * Tracks live currentToken, waitingTokens, doctor status, patient queue entries,
 * and dynamically recalculates arrival/consultation predictions on any state change.
 */
class LiveQueueManager {
  private queues: Map<string, QueueState> = new Map();
  private listeners: Set<(doctorId: string, queue: QueueState) => void> = new Set();

  constructor() {
    this.initializeQueues();
  }

  private initializeQueues() {
    DOCTORS.forEach((doc, idx) => {
      // Create a realistic daytime OPD state: doctor has seen ~15-25 patients, currentToken ~20-25
      const currentToken = 18 + (idx % 8);
      const nextToken = currentToken + 8 + (idx % 6);
      const waitingTokens: number[] = [];
      for (let t = currentToken + 1; t <= nextToken; t++) {
        waitingTokens.push(t);
      }

      const completedTokens: number[] = [];
      for (let t = 1; t < currentToken; t++) {
        completedTokens.push(t);
      }

      const recentConsultationTimes = [6, 8, 7, 9, 6];

      const initialPatients: PatientQueueEntry[] = waitingTokens.map((t, pIdx) => ({
        queueId: `q-${doc.id}-${t}`,
        doctorId: doc.id,
        patientId: `pat-${t}`,
        patientName: `Patient #${t}`,
        patientPhone: `98765000${t}`,
        tokenNumber: t,
        joinedAt: new Date(Date.now() - (waitingTokens.length - pIdx) * 8 * 60000).toISOString(),
        status: pIdx === 0 ? 'ON_THE_WAY' : 'WAITING',
        estimatedArrivalTime: 'Now',
        estimatedConsultationWindow: 'In progress',
      }));

      const queueState: QueueState = {
        doctorId: doc.id,
        doctorName: doc.name,
        currentToken,
        nextToken: nextToken + 1,
        waitingTokens,
        completedTokens,
        averageConsultationMinutes: 7,
        recentConsultationTimes,
        doctorStatus: 'WITH_PATIENT',
        breakPeriods: [],
        walkInCount: 1,
        noShowCount: 1,
        lastUpdated: new Date().toISOString(),
        patients: initialPatients,
      };

      this.queues.set(doc.id, queueState);
    });
  }

  public getQueueState(doctorId: string): QueueState {
    let q = this.queues.get(doctorId);
    if (!q) {
      const doc = DOCTORS.find(d => d.id === doctorId);
      q = {
        doctorId,
        doctorName: doc?.name || 'Doctor',
        currentToken: 1,
        nextToken: 2,
        waitingTokens: [2],
        completedTokens: [],
        averageConsultationMinutes: 7,
        recentConsultationTimes: [7, 7, 8],
        doctorStatus: 'AVAILABLE',
        breakPeriods: [],
        walkInCount: 0,
        noShowCount: 0,
        lastUpdated: new Date().toISOString(),
        patients: [],
      };
      this.queues.set(doctorId, q);
    }
    return q;
  }

  public subscribe(callback: (doctorId: string, queue: QueueState) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(doctorId: string) {
    const q = this.queues.get(doctorId);
    if (q) {
      this.listeners.forEach(cb => {
        try {
          cb(doctorId, { ...q });
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  /**
   * Get dynamic wait prediction for an existing or prospective token
   */
  public getPrediction(doctorId: string, tokenNumber?: number): QueuePredictionOutput {
    const q = this.getQueueState(doctorId);
    const targetToken = tokenNumber || q.nextToken;
    const patientsAhead = Math.max(0, targetToken - q.currentToken - 1);

    return QueuePredictionEngine.predict({
      doctorId,
      currentToken: q.currentToken,
      patientToken: targetToken,
      patientsAhead,
      recentConsultationTimes: q.recentConsultationTimes,
      averageConsultationMinutes: q.averageConsultationMinutes,
      doctorStatus: q.doctorStatus,
      walkInCount: q.walkInCount,
    });
  }

  /**
   * Patient Joins the OPD Queue (Idempotent by patientPhone + doctorId)
   * Prevents duplicate queue entries when user rapidly clicks "Join Queue".
   * If an active entry (WAITING, ON_THE_WAY, IN_CONSULTATION) exists, returns that entry.
   */
  public joinQueue(params: {
    doctorId: string;
    patientName: string;
    patientPhone: string;
    patientId?: string;
  }): {
    entry: PatientQueueEntry;
    prediction: QueuePredictionOutput;
    isExisting?: boolean;
  } {
    const q = this.getQueueState(params.doctorId);
    const cleanPhone = (params.patientPhone || '').replace(/\D/g, '');

    // Idempotency check: look for an existing ACTIVE entry for this patient
    const activeEntry = q.patients.find(p => {
      const pPhone = (p.patientPhone || '').replace(/\D/g, '');
      const isSamePhone = cleanPhone.length >= 10 && pPhone === cleanPhone;
      const isSameId = params.patientId && p.patientId === params.patientId;
      const isActiveState = p.status === 'WAITING' || p.status === 'ON_THE_WAY' || p.status === 'IN_CONSULTATION';
      return (isSamePhone || isSameId) && isActiveState;
    });

    if (activeEntry) {
      // Re-evaluate current prediction for the existing token
      const prediction = this.getPrediction(params.doctorId, activeEntry.tokenNumber);
      return { entry: activeEntry, prediction, isExisting: true };
    }

    const assignedToken = q.nextToken;
    q.nextToken += 1;
    q.waitingTokens.push(assignedToken);

    const prediction = this.getPrediction(params.doctorId, assignedToken);

    const entry: PatientQueueEntry = {
      queueId: `q-${params.doctorId}-${assignedToken}`,
      doctorId: params.doctorId,
      patientId: params.patientId || `pat-${cleanPhone || Date.now()}`,
      patientName: params.patientName,
      patientPhone: params.patientPhone,
      tokenNumber: assignedToken,
      joinedAt: new Date().toISOString(),
      status: 'WAITING',
      estimatedArrivalTime: prediction.recommendedArrivalTime,
      estimatedConsultationWindow: prediction.estimatedConsultationStart,
    };

    q.patients.push(entry);
    q.lastUpdated = new Date().toISOString();
    this.notify(params.doctorId);

    return { entry, prediction, isExisting: false };
  }

  /**
   * Patient marks "I'm on my way"
   */
  public markOnTheWay(doctorId: string, tokenNumber: number): boolean {
    const q = this.getQueueState(doctorId);
    const patient = q.patients.find(p => p.tokenNumber === tokenNumber);
    if (patient) {
      patient.status = 'ON_THE_WAY';
      patient.actualArrivalTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      q.lastUpdated = new Date().toISOString();
      this.notify(doctorId);
      return true;
    }
    return false;
  }

  /**
   * Patient leaves queue
   */
  public leaveQueue(doctorId: string, tokenNumber: number): boolean {
    const q = this.getQueueState(doctorId);
    q.waitingTokens = q.waitingTokens.filter(t => t !== tokenNumber);
    const pIdx = q.patients.findIndex(p => p.tokenNumber === tokenNumber);
    if (pIdx !== -1) {
      q.patients[pIdx].status = 'CANCELLED';
      q.lastUpdated = new Date().toISOString();
      this.notify(doctorId);
      return true;
    }
    return false;
  }

  /**
   * Clinic Action: Next Patient Completed
   */
  public advanceQueue(doctorId: string, consultationDurationMinutes: number = 7): QueueState {
    const q = this.getQueueState(doctorId);
    
    // Complete current token
    if (q.currentToken > 0) {
      q.completedTokens.push(q.currentToken);
      const currentPatient = q.patients.find(p => p.tokenNumber === q.currentToken);
      if (currentPatient) {
        currentPatient.status = 'COMPLETED';
        currentPatient.consultationEndedAt = new Date().toISOString();
      }
    }

    // Advance to next waiting token or currentToken + 1
    if (q.waitingTokens.length > 0) {
      q.currentToken = q.waitingTokens.shift()!;
    } else {
      q.currentToken += 1;
    }

    const nextPatient = q.patients.find(p => p.tokenNumber === q.currentToken);
    if (nextPatient) {
      nextPatient.status = 'IN_CONSULTATION';
      nextPatient.consultationStartedAt = new Date().toISOString();
    }

    // Update velocity
    q.recentConsultationTimes.push(consultationDurationMinutes);
    if (q.recentConsultationTimes.length > 6) {
      q.recentConsultationTimes.shift();
    }
    q.averageConsultationMinutes = Math.round(
      q.recentConsultationTimes.reduce((a, b) => a + b, 0) / q.recentConsultationTimes.length
    );

    q.doctorStatus = 'WITH_PATIENT';
    q.lastUpdated = new Date().toISOString();
    this.notify(doctorId);
    return q;
  }

  /**
   * Clinic Action: Mark Patient as NO_SHOW
   */
  public markNoShow(doctorId: string, tokenNumber: number): QueueState {
    const q = this.getQueueState(doctorId);
    q.waitingTokens = q.waitingTokens.filter(t => t !== tokenNumber);
    q.noShowCount += 1;
    const patient = q.patients.find(p => p.tokenNumber === tokenNumber);
    if (patient) {
      patient.status = 'NO_SHOW';
    }
    q.lastUpdated = new Date().toISOString();
    this.notify(doctorId);
    return q;
  }

  /**
   * Clinic Action: Add Walk-in Patient
   */
  public addWalkIn(doctorId: string, patientName: string = 'Walk-in Patient'): PatientQueueEntry {
    const q = this.getQueueState(doctorId);
    q.walkInCount += 1;
    const token = q.nextToken;
    q.nextToken += 1;
    q.waitingTokens.push(token);

    const prediction = this.getPrediction(doctorId, token);
    const entry: PatientQueueEntry = {
      queueId: `q-${doctorId}-${token}`,
      doctorId,
      patientId: `walkin-${Date.now()}`,
      patientName,
      patientPhone: '9000000000',
      tokenNumber: token,
      joinedAt: new Date().toISOString(),
      status: 'WALK_IN',
      estimatedArrivalTime: prediction.recommendedArrivalTime,
      estimatedConsultationWindow: prediction.estimatedConsultationStart,
    };

    q.patients.push(entry);
    q.lastUpdated = new Date().toISOString();
    this.notify(doctorId);
    return entry;
  }

  /**
   * Clinic Action: Update Doctor Status (e.g. BREAK, DELAYED, EMERGENCY)
   */
  public updateDoctorStatus(doctorId: string, status: DoctorQueueStatus): QueueState {
    const q = this.getQueueState(doctorId);
    q.doctorStatus = status;
    q.lastUpdated = new Date().toISOString();
    this.notify(doctorId);
    return q;
  }
}

export const liveQueueManager = new LiveQueueManager();
