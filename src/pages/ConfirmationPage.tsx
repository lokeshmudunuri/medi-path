import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  Building2, 
  MapPin, 
  AlertCircle,
  RefreshCw,
  Printer,
  ArrowRight,
  Radio
} from 'lucide-react';
import { onlineServerAPI } from '../server/api';
import { liveQueueManager } from '../queue/LiveQueueManager';
import type { Appointment } from '../types/booking';
import type { QueueState, QueuePredictionOutput } from '../types/queue';

export const ConfirmationPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [prediction, setPrediction] = useState<QueuePredictionOutput | null>(null);
  const [isOnTheWay, setIsOnTheWay] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appointmentId) return;
    onlineServerAPI.getAppointment(appointmentId).then((apt) => {
      setAppointment(apt);
      setLoading(false);

      if (apt?.doctorId) {
        const q = liveQueueManager.getQueueState(apt.doctorId);
        setQueueState(q);
        const pred = liveQueueManager.getPrediction(apt.doctorId, apt.tokenNumber);
        setPrediction(pred);

        // Check if already on the way
        const patientEntry = q.patients.find(p => p.tokenNumber === apt.tokenNumber);
        if (patientEntry?.status === 'ON_THE_WAY') {
          setIsOnTheWay(true);
        }
      }
    });
  }, [appointmentId]);

  // Subscribe to live queue state updates
  useEffect(() => {
    if (!appointment?.doctorId) return;

    const unsubscribe = liveQueueManager.subscribe((docId, updatedQ) => {
      if (docId === appointment.doctorId) {
        setQueueState(updatedQ);
        const pred = liveQueueManager.getPrediction(docId, appointment.tokenNumber);
        setPrediction(pred);

        const patientEntry = updatedQ.patients.find(p => p.tokenNumber === appointment.tokenNumber);
        if (patientEntry?.status === 'ON_THE_WAY') {
          setIsOnTheWay(true);
        }
      }
    });

    return () => unsubscribe();
  }, [appointment?.doctorId, appointment?.tokenNumber]);

  const handleMarkOnTheWay = () => {
    if (!appointment || !appointment.tokenNumber) return;
    liveQueueManager.markOnTheWay(appointment.doctorId, appointment.tokenNumber);
    setIsOnTheWay(true);
  };

  const handleLeaveQueue = () => {
    if (!appointment || !appointment.tokenNumber) return;
    if (window.confirm('Are you sure you want to leave the queue? Your token will be cancelled.')) {
      liveQueueManager.leaveQueue(appointment.doctorId, appointment.tokenNumber);
      alert('You have left the queue.');
      navigate('/doctors');
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <RefreshCw size={36} className="spin-icon" style={{ margin: '0 auto 1rem auto', color: 'var(--primary)' }} />
        <p style={{ color: 'var(--gray-600)' }}>Retrieving confirmed booking details...</p>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <AlertCircle size={44} color="#dc2626" style={{ margin: '0 auto 1rem auto' }} />
        <h2>Booking Not Found</h2>
        <p style={{ color: 'var(--gray-600)', margin: '0.5rem 0 1.5rem 0' }}>
          We could not locate this appointment reference.
        </p>
        <Link to="/doctors" className="btn-primary">
          Browse Doctors
        </Link>
      </div>
    );
  }

  const isFailed = appointment.status === 'PAYMENT_FAILED';
  const myToken = appointment.tokenNumber || 40;
  const currentToken = queueState ? queueState.currentToken : 20;
  const patientsAhead = Math.max(0, myToken - currentToken - 1);
  const consultationWindow = prediction?.estimatedConsultationStart || appointment.estimatedConsultationWindow;
  const recommendedArrival = prediction?.recommendedArrivalTime || appointment.recommendedArrivalTime;

  return (
    <div className="confirmation-page-wrap" id="confirmation-page">
      <div className="container" style={{ maxWidth: '640px' }}>
        <div className="confirmation-card" style={{ border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          {/* Header Status */}
          <div 
            className="confirmation-header"
            style={isFailed ? { background: '#fef2f2', borderBottom: '1px solid #fecaca' } : { background: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}
          >
            <div 
              className="confirmation-icon-circle"
              style={isFailed ? { background: '#dc2626' } : { background: '#16a34a' }}
            >
              {isFailed ? <AlertCircle size={32} /> : <CheckCircle2 size={32} />}
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: isFailed ? '#991b1b' : '#14532d', marginBottom: '0.2rem' }}>
              {isFailed ? 'Payment Not Completed' : 'Queue Joined Successfully'}
            </h1>
            <p style={{ color: isFailed ? '#b91c1c' : '#166534', fontSize: '0.9rem' }}>
              {isFailed 
                ? 'Your mock payment was unsuccessful. This appointment is NOT confirmed.'
                : `Booking Reference: ${appointment.bookingRef}`}
            </p>
          </div>

          {/* Clean Patient Live Queue Card (Part 4 Spec) */}
          <div style={{ padding: '1.75rem' }}>
            {/* Doctor Info */}
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.25rem 0' }}>
                {appointment.doctorName}
              </h2>
              <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.4rem 0' }}>
                {appointment.doctorSpecialty}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--gray-500)' }}>
                <Building2 size={14} />
                <span>{appointment.hospitalName}</span>
                <span>•</span>
                <MapPin size={14} />
                <span>{appointment.hospitalAddress}</span>
              </div>
            </div>

            {/* Primary Queue Display (Token, Current, Ahead) */}
            <div style={{ 
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', 
              color: '#ffffff', 
              borderRadius: '1rem', 
              padding: '1.5rem', 
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.15)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, fontWeight: 700 }}>
                YOUR TOKEN
              </div>
              <div style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1, margin: '0.5rem 0', color: '#38bdf8' }}>
                #{myToken}
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.75, fontWeight: 600 }}>CURRENT TOKEN</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>#{currentToken}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', opacity: 0.75, fontWeight: 600 }}>PEOPLE AHEAD</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#facc15' }}>{patientsAhead}</div>
                </div>
              </div>
            </div>

            {/* Clean Timing Windows */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Estimated Consultation
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {consultationWindow}
                </div>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#166534', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  Recommended Arrival
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#15803d' }}>
                  {recommendedArrival}
                </div>
              </div>
            </div>

            {/* Live Indicator */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
              <Radio size={14} color="#16a34a" className="pulse-indicator" />
              <span>LIVE: Queue updates automatically</span>
            </div>

            {/* Patient Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button 
                type="button" 
                className="btn-primary" 
                style={{ 
                  background: isOnTheWay ? '#16a34a' : 'var(--primary)', 
                  padding: '0.85rem', 
                  fontSize: '0.95rem',
                  fontWeight: 700 
                }}
                onClick={handleMarkOnTheWay}
                disabled={isOnTheWay}
              >
                {isOnTheWay ? '✓ Clinic Notified: You are on your way' : "🚀 I'M ON MY WAY"}
              </button>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <Link 
                  to={`/queue/${appointment.doctorId}`} 
                  className="btn-secondary" 
                  style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.88rem' }}
                >
                  VIEW LIVE QUEUE
                </Link>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ color: '#dc2626', borderColor: '#fecaca', background: '#fff5f5', padding: '0.75rem', fontSize: '0.88rem' }}
                  onClick={handleLeaveQueue}
                >
                  LEAVE QUEUE
                </button>
              </div>
            </div>

            {/* Patient & Payment summary */}
            <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '1.25rem', marginTop: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Patient</span>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{appointment.patientName}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>{appointment.patientPhone}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Payment Details</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    ₹{appointment.consultationFee} • {appointment.paymentMethod}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#16a34a', fontWeight: 600 }}>
                    Status: {appointment.paymentStatus === 'PAID' ? 'Demo Payment — Successful' : 'Pay at Clinic Desk'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="confirmation-card-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
            >
              <Printer size={15} />
              <span>Print Slip</span>
            </button>

            <Link
              to="/doctors"
              className="btn-primary"
              style={{ padding: '0.65rem 1.4rem' }}
            >
              <span>Back to Doctor Directory</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
