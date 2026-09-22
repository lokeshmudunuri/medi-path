import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  getDoctorById 
} from '../services/searchService';
import { 
  Star, 
  MapPin, 
  Building2, 
  Clock, 
  Video, 
  ShieldCheck, 
  Calendar, 
  CheckCircle2, 
  ChevronLeft,
  AlertCircle
} from 'lucide-react';

export const DoctorProfilePage: React.FC = () => {
  const { doctorId } = useParams<{ doctorId: string }>();
  const navigate = useNavigate();
  const doctor = doctorId ? getDoctorById(doctorId) : undefined;

  if (!doctor) {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <AlertCircle size={48} color="var(--primary)" style={{ margin: '0 auto 1rem auto' }} />
        <h2>Doctor Not Found</h2>
        <p style={{ color: 'var(--gray-600)', margin: '0.5rem 0 1.5rem 0' }}>
          We could not locate the practitioner you requested.
        </p>
        <Link to="/doctors" className="btn-primary">
          Back to Doctor Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="profile-page-wrap" id="doctor-profile-page">
      <div className="container">
        {/* Breadcrumb Navigation */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link
            to={`/doctors?location=${encodeURIComponent(doctor.locationName)}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: 'var(--primary)',
              fontSize: '0.9rem',
              fontWeight: 500,
            }}
          >
            <ChevronLeft size={16} />
            <span>Back to doctors in {doctor.locationName}</span>
          </Link>
        </div>

        {/* Hero Card */}
        <div className="profile-card-hero">
          <img
            src={doctor.avatarUrl}
            alt={doctor.name}
            className="profile-avatar-large"
          />

          <div className="profile-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#28328c' }}>
                {doctor.name}
              </h1>
              <span title="Verified Profile">
                <ShieldCheck size={22} color="var(--primary)" />
              </span>
            </div>

            <p style={{ fontSize: '1.05rem', color: 'var(--primary)', fontWeight: 600, margin: '0.2rem 0 0.5rem 0' }}>
              {doctor.specialty}
            </p>

            <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', marginBottom: '0.4rem' }}>
              {doctor.qualifications}
            </p>

            <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--gray-800)', marginBottom: '0.75rem' }}>
              {doctor.experience} Years Experience Overall
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gray-700)', fontSize: '0.9rem' }}>
                <Building2 size={16} color="var(--gray-500)" />
                <span>{doctor.hospitalName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--gray-700)', fontSize: '0.9rem' }}>
                <MapPin size={16} color="var(--gray-500)" />
                <span>{doctor.locality}, {doctor.locationName}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {doctor.consultationTypes.map((type) => (
                <span key={type} className="tag-badge" style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem' }}>
                  {type === 'Video Consultation' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Video size={13} /> {type}
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Building2 size={13} /> {type}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Quick Booking Box */}
          <div className="profile-sidebar">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="doc-rating-badge">
                  <Star size={14} fill="#fff" />
                  <span>{doctor.rating.toFixed(1)}</span>
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                  {doctor.reviewCount} verified stories
                </span>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Consultation Fee</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--gray-900)' }}>
                  ₹{doctor.consultationFee}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>
                <Clock size={16} />
                <span>Live OPD Queue • Fast Token Allocation</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                type="button"
                className="btn-primary"
                id="book-appointment-btn"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem' }}
                onClick={() => navigate(`/booking/${doctor.id}`)}
              >
                <Calendar size={18} />
                <span>Join Doctor Queue (Get Token)</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem', textAlign: 'center' }}
                onClick={() => navigate(`/queue/${doctor.id}`)}
              >
                📊 Live Doctor Queue Console
              </button>
            </div>
          </div>
        </div>

        {/* Details & About Section */}
        <div className="profile-section">
          <h3>About Doctor</h3>
          <p style={{ color: 'var(--gray-700)', lineHeight: '1.7', fontSize: '0.95rem' }}>
            {doctor.about}
          </p>
        </div>

        {/* Services & Specializations */}
        <div className="profile-section">
          <h3>Services & Treatments</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {doctor.services.map((srv, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--gray-700)' }}>
                <CheckCircle2 size={16} color="var(--primary)" />
                <span>{srv}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Clinic & Timing Information */}
        <div className="profile-section">
          <h3>Clinic & Availability Details</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--gray-800)' }}>
                Hospital / Clinic Location
              </h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
                <strong>{doctor.hospitalName}</strong>
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                {doctor.locality}, {doctor.locationName}
              </p>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--gray-800)' }}>
                Consultation Timings
              </h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)' }}>
                Days: <strong>{doctor.availability.days.join(', ')}</strong>
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                Hours: {doctor.availability.timing}
              </p>
            </div>
          </div>
        </div>

        {/* Patient Reviews Section */}
        <div className="profile-section" id="patient-reviews-section">
          <h3>Patient Stories & Feedback ({doctor.reviewCount})</h3>
          {doctor.reviews.map((rev) => (
            <div
              key={rev.id}
              style={{
                borderBottom: '1px solid var(--gray-200)',
                paddingBottom: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--gray-800)' }}>
                    {rev.userName}
                  </span>
                  {rev.verified && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--success)',
                        backgroundColor: 'var(--success-bg)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 600,
                      }}
                    >
                      Verified Patient
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)' }}>{rev.date}</span>
              </div>

              <div style={{ display: 'flex', gap: '2px', marginBottom: '0.4rem' }}>
                {Array.from({ length: rev.rating }).map((_, i) => (
                  <Star key={i} size={14} fill="#eab308" color="#eab308" />
                ))}
              </div>

              <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', lineHeight: '1.5' }}>
                "{rev.comment}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
