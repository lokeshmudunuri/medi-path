import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  UserCheck, 
  UserX, 
  UserPlus, 
  RefreshCw
} from 'lucide-react';
import { onlineServerAPI } from '../server/api';
import { liveQueueManager } from '../queue/LiveQueueManager';
import type { Doctor } from '../types/index';
import type { QueueState, DoctorQueueStatus } from '../types/queue';

export const ClinicQueueDashboardPage: React.FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [queue, setQueue] = useState<QueueState | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [showWalkInModal, setShowWalkInModal] = useState(false);

  useEffect(() => {
    if (!doctorId) return;
    onlineServerAPI.getDoctorById(doctorId).then(setDoctor);

    const initialQ = liveQueueManager.getQueueState(doctorId);
    setQueue(initialQ);

    const unsubscribe = liveQueueManager.subscribe((docId, updatedQ) => {
      if (docId === doctorId) {
        setQueue({ ...updatedQ });
      }
    });

    return () => unsubscribe();
  }, [doctorId]);

  if (!doctor || !queue) {
    return (
      <div className="container" style={{ padding: '5rem 0', textAlign: 'center' }}>
        <RefreshCw size={36} className="spin-icon" style={{ margin: '0 auto 1rem auto', color: 'var(--primary)' }} />
        <p style={{ color: 'var(--gray-600)' }}>Loading OPD Live Queue Dashboard...</p>
      </div>
    );
  }

  const handleNextPatient = () => {
    liveQueueManager.advanceQueue(doctor.id, Math.floor(6 + Math.random() * 4));
  };

  const handleStatusChange = (status: DoctorQueueStatus) => {
    liveQueueManager.updateDoctorStatus(doctor.id, status);
  };

  const handleNoShow = (token: number) => {
    liveQueueManager.markNoShow(doctor.id, token);
  };

  const handleAddWalkIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInName.trim()) return;
    liveQueueManager.addWalkIn(doctor.id, walkInName.trim());
    setWalkInName('');
    setShowWalkInModal(false);
  };

  return (
    <div className="clinic-dashboard-wrap" style={{ padding: '2rem 0', background: '#f8fafc', minHeight: '85vh' }}>
      <div className="container">
        {/* Header navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <button 
            type="button" 
            className="btn-secondary" 
            onClick={() => navigate(-1)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.88rem' }}
          >
            <ChevronLeft size={16} /> Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-600)' }}>Doctor Status:</span>
            <select
              className="sort-select"
              value={queue.doctorStatus}
              onChange={(e) => handleStatusChange(e.target.value as DoctorQueueStatus)}
              style={{ padding: '0.35rem 0.75rem', fontWeight: 600 }}
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="WITH_PATIENT">WITH PATIENT</option>
              <option value="BREAK">ON BREAK</option>
              <option value="DELAYED">DELAYED</option>
              <option value="EMERGENCY">EMERGENCY</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>
          </div>
        </div>

        {/* Title Bar */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="live-status-pill"><span className="live-dot"></span> Real-Time OPD Console</span>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', marginTop: '0.3rem' }}>
                {doctor.name} • {doctor.specialty}
              </h1>
              <p style={{ color: 'var(--gray-600)', fontSize: '0.9rem' }}>
                {doctor.hospitalName}, {doctor.locationName}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowWalkInModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1rem' }}
              >
                <UserPlus size={16} /> Add Walk-In Patient
              </button>

              <button
                type="button"
                className="btn-primary"
                onClick={handleNextPatient}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 1.25rem', background: '#16a34a' }}
              >
                <UserCheck size={16} /> Complete & Call Next Patient
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="dashboard-metric-card">
            <span className="card-lbl">Current Token In-Room</span>
            <span className="card-val highlight-blue">#{queue.currentToken}</span>
            <span className="card-sub">{queue.doctorStatus}</span>
          </div>

          <div className="dashboard-metric-card">
            <span className="card-lbl">Patients In Queue</span>
            <span className="card-val">{queue.waitingTokens.length}</span>
            <span className="card-sub">Next Token: #{queue.waitingTokens[0] || 'None'}</span>
          </div>

          <div className="dashboard-metric-card">
            <span className="card-lbl">Patients Served Today</span>
            <span className="card-val" style={{ color: '#16a34a' }}>{queue.completedTokens.length}</span>
            <span className="card-sub">Completed</span>
          </div>

          <div className="dashboard-metric-card">
            <span className="card-lbl">Avg Consultation Speed</span>
            <span className="card-val">{queue.averageConsultationMinutes} min</span>
            <span className="card-sub">Recent: {queue.recentConsultationTimes.join(', ')}m</span>
          </div>

          <div className="dashboard-metric-card">
            <span className="card-lbl">Walk-Ins / No-Shows</span>
            <span className="card-val" style={{ fontSize: '1.4rem' }}>{queue.walkInCount} / {queue.noShowCount}</span>
            <span className="card-sub">Adjusted in real-time</span>
          </div>
        </div>

        {/* Queue Table */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>
            Live Patient Queue Order
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '0.65rem' }}>Token #</th>
                  <th style={{ padding: '0.65rem' }}>Patient Name</th>
                  <th style={{ padding: '0.65rem' }}>Status</th>
                  <th style={{ padding: '0.65rem' }}>Est. Window</th>
                  <th style={{ padding: '0.65rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.patients.map((patient) => (
                  <tr 
                    key={patient.queueId} 
                    style={{ 
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: patient.tokenNumber === queue.currentToken ? '#e8f5fb' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '0.75rem', fontWeight: 700, color: '#28328c' }}>
                      #{patient.tokenNumber}
                      {patient.tokenNumber === queue.currentToken && (
                        <span style={{ marginLeft: '6px', fontSize: '0.72rem', background: '#0284c7', color: '#ffffff', padding: '2px 6px', borderRadius: '4px' }}>
                          Current
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{patient.patientName}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`patient-status-pill ${patient.status.toLowerCase()}`}>
                        {patient.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#475569' }}>
                      {patient.estimatedConsultationWindow}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      {patient.status === 'WAITING' && (
                        <button
                          type="button"
                          className="btn-mark-noshow"
                          title="Mark patient as No-Show to recalculate wait time"
                          onClick={() => handleNoShow(patient.tokenNumber)}
                        >
                          <UserX size={13} style={{ display: 'inline', marginRight: '4px' }} />
                          Mark No-Show
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Walk-In Modal */}
        {showWalkInModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Add Walk-in Patient</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                Walk-ins will be inserted into the queue sequence and wait time for future patients will automatically adjust.
              </p>
              <form onSubmit={handleAddWalkIn}>
                <input
                  type="text"
                  required
                  placeholder="Patient Name"
                  className="intake-input-field"
                  style={{ width: '100%', marginBottom: '1rem' }}
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setShowWalkInModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Allocate Token & Insert
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
