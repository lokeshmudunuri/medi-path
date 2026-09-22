import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, 
  Phone, 
  CreditCard, 
  Building2, 
  MapPin, 
  ChevronLeft, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw,
  Info
} from 'lucide-react';
import { onlineServerAPI } from '../server/api';
import { liveQueueManager } from '../queue/LiveQueueManager';
import type { Doctor } from '../types/index';
import type { PaymentMethod } from '../types/booking';
import type { QueueState, QueuePredictionOutput } from '../types/queue';

export const BookingPage: React.FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);

  // Queue & Token State
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [prediction, setPrediction] = useState<QueuePredictionOutput | null>(null);

  // Patient Info
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [consultationType, setConsultationType] = useState<'In-Clinic' | 'Video Consultation'>('In-Clinic');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);

  // Fetch Doctor & Setup Live Queue Subscription
  useEffect(() => {
    if (!doctorId) return;
    setLoadingDoc(true);

    onlineServerAPI.getDoctorById(doctorId).then((doc) => {
      setDoctor(doc);
      setLoadingDoc(false);
    });

    // Subscribe to live queue state updates
    const initialQ = liveQueueManager.getQueueState(doctorId);
    setQueueState(initialQ);
    setPrediction(liveQueueManager.getPrediction(doctorId));

    const unsubscribe = liveQueueManager.subscribe((docId, updatedQ) => {
      if (docId === doctorId) {
        setQueueState(updatedQ);
        setPrediction(liveQueueManager.getPrediction(doctorId));
      }
    });

    return () => unsubscribe();
  }, [doctorId]);

  const handleQueueJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor || !queueState || !prediction) {
      setErrorMsg('Queue information is loading. Please try again in a moment.');
      return;
    }

    if (!patientName.trim() || !patientPhone.trim()) {
      setErrorMsg('Please provide your name and phone number.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Join live in-memory OPD queue
      const { entry, prediction: joinPrediction } = liveQueueManager.joinQueue({
        doctorId: doctor.id,
        patientName,
        patientPhone,
      });

      const todayStr = new Date().toISOString().split('T')[0];

      // 2. Create authoritative Appointment representation
      const appointment = await onlineServerAPI.createAppointment({
        doctorId: doctor.id,
        date: todayStr,
        slotId: `token-${entry.tokenNumber}`,
        patientName,
        patientPhone,
        paymentMethod,
        consultationType,
        tokenNumber: entry.tokenNumber,
        estimatedConsultationWindow: joinPrediction.estimatedConsultationStart,
        recommendedArrivalTime: joinPrediction.recommendedArrivalTime,
      });

      // 3. Process Mock Payment on Server
      const paymentResult = await onlineServerAPI.processMockPayment({
        appointmentId: appointment.id,
        paymentMethod,
        amount: doctor.consultationFee,
        shouldFail: simulateFailure,
      });

      if (paymentResult.status === 'FAILED') {
        setErrorMsg(paymentResult.message || 'Payment simulation declined. Please try again.');
        setSubmitting(false);
        return;
      }

      // 4. Navigate to Confirmation Page with Token Details
      navigate(`/booking/confirmation/${appointment.id}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to join doctor queue. Please try again.');
      setSubmitting(false);
    }
  };

  if (loadingDoc) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <RefreshCw size={36} className="spin-icon" style={{ margin: '0 auto 1rem auto', color: 'var(--primary)' }} />
        <p style={{ color: 'var(--gray-600)' }}>Loading doctor OPD queue status...</p>
      </div>
    );
  }

  if (!doctor || !queueState || !prediction) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <AlertCircle size={44} color="#dc2626" style={{ margin: '0 auto 1rem auto' }} />
        <h2>Doctor Queue Unavailable</h2>
        <p style={{ color: 'var(--gray-600)', margin: '0.5rem 0 1.5rem 0' }}>
          This doctor OPD queue is currently not accepting new patients.
        </p>
        <button type="button" className="btn-primary" onClick={() => navigate('/doctors')}>
          Browse Other Doctors
        </button>
      </div>
    );
  }

  const assignedToken = queueState.nextToken;
  const patientsAhead = Math.max(0, assignedToken - queueState.currentToken - 1);

  return (
    <div className="booking-page-wrap" id="queue-booking-page">
      <div className="container">
        {/* Back Link */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
          >
            <ChevronLeft size={16} />
            <span>Back to Doctor Profile</span>
          </button>
        </div>

        <div className="booking-layout-grid">
          {/* Left Column: Live Queue & Join Form */}
          <div className="booking-form-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
                Join Doctor OPD Queue
              </h1>
              <span className="live-status-pill">
                <span className="live-dot"></span> Live Queue Active
              </span>
            </div>

            {errorMsg && (
              <div className="ai-alert ai-alert-error" id="booking-error-box" style={{ marginBottom: '1.5rem' }}>
                <AlertCircle size={18} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Live Token Status Banner */}
            <div className="queue-status-dashboard-card">
              <div className="queue-metric-group">
                <span className="metric-label">CURRENT SERVING TOKEN</span>
                <span className="metric-val active-token">#{queueState.currentToken}</span>
                <span className="metric-sub">{queueState.doctorStatus.replace('_', ' ')}</span>
              </div>

              <div className="queue-divider"></div>

              <div className="queue-metric-group">
                <span className="metric-label">YOUR TOKEN WILL BE</span>
                <span className="metric-val your-token">#{assignedToken}</span>
                <span className="metric-sub">{patientsAhead} patient{patientsAhead === 1 ? '' : 's'} ahead</span>
              </div>

              <div className="queue-divider"></div>

              <div className="queue-metric-group">
                <span className="metric-label">ESTIMATED CONSULTATION</span>
                <span className="metric-val time-window">{prediction.estimatedConsultationStart}</span>
                <span className="metric-sub highlight-arrival">Arrive by {prediction.recommendedArrivalTime}</span>
              </div>
            </div>

            <form onSubmit={handleQueueJoin}>
              {/* Consultation Mode */}
              <div className="booking-section-block">
                <label className="booking-field-label">Consultation Mode</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {doctor.consultationTypes.map((type) => (
                    <label 
                      key={type} 
                      className={`mode-selector-chip ${consultationType === type ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="consultMode"
                        checked={consultationType === type}
                        onChange={() => setConsultationType(type)}
                        style={{ display: 'none' }}
                      />
                      <span>{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Patient Contact Information */}
              <div className="booking-section-block">
                <label className="booking-field-label">Patient Details</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Patient Full Name *</span>
                    <div className="input-with-icon">
                      <User size={16} />
                      <input
                        type="text"
                        required
                        id="patient-name-input"
                        placeholder="e.g. Ramesh Kumar"
                        value={patientName}
                        onChange={(e) => setPatientName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Phone Number *</span>
                    <div className="input-with-icon">
                      <Phone size={16} />
                      <input
                        type="tel"
                        required
                        id="patient-phone-input"
                        placeholder="e.g. 9876543210"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="booking-section-block">
                <label className="booking-field-label">Payment Method (Mock Demo)</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {(['UPI', 'Card', 'Cash at Clinic'] as PaymentMethod[]).map((method) => (
                    <label key={method} className="payment-method-row">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                      />
                      <CreditCard size={18} color="var(--primary)" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                          {method === 'UPI' ? 'UPI (Google Pay, PhonePe, Paytm)' : method === 'Card' ? 'Credit / Debit Card' : 'Pay Cash at Hospital Desk'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--gray-500)' }}>
                          {method === 'Cash at Clinic' ? 'Join queue now, pay consultation fee at OPD counter' : 'Instant simulated sandbox verification'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sandbox Failure Simulation Toggle */}
              <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px dashed #cbd5e1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: 'pointer', color: '#475569' }}>
                  <input
                    type="checkbox"
                    checked={simulateFailure}
                    onChange={(e) => setSimulateFailure(e.target.checked)}
                  />
                  <span>Simulate Payment Failure (Demonstrates rejected payment state)</span>
                </label>
              </div>

              {/* Join Queue Button */}
              <button
                type="submit"
                id="join-queue-submit-btn"
                className="btn-primary"
                disabled={submitting}
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', justifyContent: 'center' }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={18} className="spin-icon" />
                    <span>Joining queue...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Join Queue • Get Token #{assignedToken} (₹{doctor.consultationFee})</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Doctor & Live Queue Summary */}
          <div className="booking-summary-sidebar">
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
              <img
                src={doctor.avatarUrl}
                alt={doctor.name}
                style={{ width: '70px', height: '70px', borderRadius: 'var(--radius-full)', objectFit: 'cover' }}
              />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#28328c' }}>{doctor.name}</h3>
                <p style={{ color: 'var(--primary)', fontSize: '0.88rem', fontWeight: 600 }}>{doctor.specialty}</p>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.8rem' }}>{doctor.experience} yrs exp</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--gray-700)', marginBottom: '0.4rem' }}>
                <Building2 size={15} color="var(--gray-500)" />
                <span>{doctor.hospitalName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--gray-700)' }}>
                <MapPin size={15} color="var(--gray-500)" />
                <span>{doctor.locality}, {doctor.locationName}</span>
              </div>
            </div>

            <div style={{ background: '#ffffff', borderRadius: 'var(--radius-sm)', padding: '0.85rem', border: '1px solid var(--gray-200)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--gray-500)' }}>Token Assigned:</span>
                <span style={{ fontWeight: 700, color: '#28328c' }}>#{assignedToken}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--gray-500)' }}>Est. Consultation:</span>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{prediction.estimatedConsultationStart}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--gray-500)' }}>Recommended Arrival:</span>
                <span style={{ fontWeight: 700, color: '#166534' }}>{prediction.recommendedArrivalTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', borderTop: '1px dashed var(--gray-200)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>Consultation Fee:</span>
                <span style={{ fontWeight: 800, color: 'var(--gray-900)' }}>₹{doctor.consultationFee}</span>
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                OPD Queue System: Live dynamic predictions adjust automatically if patients take longer or doctor takes a break.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
