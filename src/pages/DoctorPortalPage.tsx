import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  UserPlus, 
  Clock, 
  CheckCircle2, 
  AlertCircle
} from 'lucide-react';
import { onlineServerAPI } from '../server/api';
import { liveQueueManager } from '../queue/LiveQueueManager';
import { SPECIALTIES, LOCATIONS } from '../data/mockData';
import type { RegisteredDoctor } from '../types/doctorPortal';
import type { QueueState, DoctorQueueStatus } from '../types/queue';

export const DoctorPortalPage: React.FC = () => {
  const navigate = useNavigate();

  // Registration Form State
  const [fullName, setFullName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [specialty, setSpecialty] = useState(SPECIALTIES[0]?.name || 'Cardiologist');
  const [hospitalName, setHospitalName] = useState('Apollo Health City');
  const [locationName, setLocationName] = useState(LOCATIONS[0]?.name || 'Bengaluru');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [experienceYears, setExperienceYears] = useState(8);
  const [consultationFee, setConsultationFee] = useState(600);
  const [profileBio, setProfileBio] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Doctor Dashboard State after registration
  const [activeDoctor, setActiveDoctor] = useState<RegisteredDoctor | null>(null);
  const [queueState, setQueueState] = useState<QueueState | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || fullName.trim().length < 3) {
      setErrorMsg('Please enter your full legal practitioner name.');
      return;
    }
    if (!registrationNumber.trim()) {
      setErrorMsg('State Medical Council registration number is required.');
      return;
    }

    setSubmitting(true);
    try {
      const registered = await onlineServerAPI.registerDoctor({
        fullName,
        registrationNumber,
        specialty,
        hospitalName,
        locationName,
        phone: phone.trim() || '9876543210',
        email: email.trim() || 'doctor@medipath.local',
        experienceYears: Number(experienceYears) || 5,
        consultationFee: Number(consultationFee) || 500,
        profileBio: profileBio.trim() || 'Practitioner on MediPath clinical network.',
      });

      setActiveDoctor(registered);

      // Initialize live queue state for this new registered doctor
      const q = liveQueueManager.getQueueState(registered.id);
      setQueueState({ ...q });

      // Subscribe to real-time updates
      liveQueueManager.subscribe((docId, updatedQ) => {
        if (docId === registered.id) {
          setQueueState({ ...updatedQ });
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to register doctor profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallNext = () => {
    if (!activeDoctor) return;
    const updated = liveQueueManager.advanceQueue(activeDoctor.id, 8);
    setQueueState({ ...updated });
  };

  const handleStatusChange = (status: DoctorQueueStatus) => {
    if (!activeDoctor) return;
    liveQueueManager.updateDoctorStatus(activeDoctor.id, status);
    const updated = liveQueueManager.getQueueState(activeDoctor.id);
    setQueueState({ ...updated });
  };

  // If already registered in session, show Doctor Dashboard
  if (activeDoctor && queueState) {
    return (
      <div className="container" style={{ padding: '2.5rem 1rem', maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.6rem', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              <CheckCircle2 size={13} />
              <span>Demo Medical Practitioner Registration Verified</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {activeDoctor.fullName.startsWith('Dr.') ? activeDoctor.fullName : `Dr. ${activeDoctor.fullName}`}
            </h1>
            <p style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.95rem', margin: '0.2rem 0' }}>
              {activeDoctor.specialty} • {activeDoctor.hospitalName} ({activeDoctor.locationName})
            </p>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Medical Registration Reg No: <strong>{activeDoctor.registrationNumber}</strong>
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link to={`/queue/${activeDoctor.id}`} className="btn-secondary" style={{ fontSize: '0.85rem' }}>
              Open Full Screen Clinic Console
            </Link>
            <button 
              type="button" 
              className="btn-secondary"
              onClick={() => setActiveDoctor(null)}
              style={{ fontSize: '0.85rem' }}
            >
              Register Another Doctor
            </button>
          </div>
        </div>

        {/* Real-time OPD Queue Dashboard */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color="var(--primary)" />
            Today's OPD Live Queue
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CURRENT TOKEN</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary)' }}>#{queueState.currentToken}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>WAITING</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#f59e0b' }}>{queueState.waitingTokens.length}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>COMPLETED</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#10b981' }}>{queueState.completedTokens.length}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>AVG CONSULTATION</div>
              <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#3b82f6' }}>{queueState.averageConsultationMinutes}m</div>
            </div>
          </div>

          {/* Doctor Status Bar */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Doctor Status:</span>
            {(['AVAILABLE', 'WITH_PATIENT', 'BREAK', 'DELAYED', 'EMERGENCY'] as DoctorQueueStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => handleStatusChange(st)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: queueState.doctorStatus === st ? '2px solid var(--primary)' : '1px solid #cbd5e1',
                  background: queueState.doctorStatus === st ? '#eff6ff' : '#ffffff',
                  color: queueState.doctorStatus === st ? 'var(--primary)' : '#475569',
                  cursor: 'pointer'
                }}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCallNext}
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
            >
              👉 Call Next Patient (Token #{queueState.waitingTokens[0] || queueState.currentToken + 1})
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleStatusChange('WITH_PATIENT')}
              style={{ padding: '0.75rem 1.25rem' }}
            >
              Start Consultation
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleCallNext}
              style={{ padding: '0.75rem 1.25rem' }}
            >
              Complete Patient
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button 
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/doctors')}
            style={{ fontSize: '0.9rem' }}
          >
            Go to Patient Doctor Directory
          </button>
        </div>
      </div>
    );
  }

  // Registration Form View
  return (
    <div className="container" style={{ padding: '3rem 1rem', maxWidth: '720px' }}>
      <div style={{ background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0', padding: '2rem', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '50%', background: '#eff6ff', color: 'var(--primary)', marginBottom: '0.75rem' }}>
            <UserPlus size={26} />
          </div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.4rem 0' }}>
            Doctor Registration Portal
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '520px', margin: '0 auto' }}>
            Register your clinical practice on MediPath. Once registered, patients can find your profile, view live OPD queues, and obtain digital tokens.
          </p>
          <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: '#94a3b8' }}>
            Notice: Medical registration number is captured for demo verification purposes.
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c', fontSize: '0.88rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Full Name (with Dr. prefix) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Dr. Ananya Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Medical Reg. Number *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. MCI-2018-84729"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Specialty *
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', background: '#fff' }}
              >
                {SPECIALTIES.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Hospital / Clinic Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Apollo Hospital"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                City / Location *
              </label>
              <select
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', background: '#fff' }}
              >
                {LOCATIONS.map(l => (
                  <option key={l.id} value={l.name}>{l.name} ({l.state})</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="doctor@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Years of Experience
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Consultation Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={consultationFee}
                onChange={(e) => setConsultationFee(Number(e.target.value))}
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
              Professional Summary / Bio
            </label>
            <textarea
              rows={3}
              placeholder="Describe clinical interests, degrees, and hospital affiliations..."
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
              style={{ width: '100%', padding: '0.65rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem' }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{ padding: '0.85rem', fontSize: '1rem', marginTop: '0.5rem' }}
          >
            {submitting ? 'Registering Practitioner...' : 'Register Practitioner Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};
