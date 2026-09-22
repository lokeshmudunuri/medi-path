import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Video, Clock, Users } from 'lucide-react';
import { SearchBar } from '../components/SearchBar';
import { SpecialtyGrid } from '../components/SpecialtyGrid';
import { AIAssistedSearch } from '../components/AIAssistedSearch';
import { useLocation } from '../context/LocationContext';

export const HomePage: React.FC = () => {
  const { selectedLocation } = useLocation();
  const navigate = useNavigate();

  return (
    <div id="home-page">
      {/* Hero / Dual Search Banner */}
      <section className="search-banner-wrap">
        <div className="container">
          <h1 className="search-banner-title">Your Home For Health</h1>
          <p className="search-banner-sub">
            Find and book appointments with verified doctors in {selectedLocation.name}
          </p>

          <SearchBar />

          {/* Quick Symptoms / Popular Queries */}
          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.6rem',
              flexWrap: 'wrap',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ color: 'var(--gray-500)', fontWeight: 600 }}>Popular searches:</span>
            {['fever', 'skin problem', 'Dr. Rajesh', 'knee pain', 'Cardiologist', 'Dentist'].map((term) => (
              <button
                key={term}
                type="button"
                className="tag-badge"
                style={{
                  cursor: 'pointer',
                  border: '1px solid var(--gray-200)',
                  backgroundColor: '#ffffff',
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.82rem',
                }}
                onClick={() =>
                  navigate(`/doctors?location=${encodeURIComponent(selectedLocation.name)}&query=${encodeURIComponent(term)}`)
                }
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stage 2: Offline On-Device AI Discovery Section */}
      <AIAssistedSearch />

      {/* Specialty Grid Section */}
      <SpecialtyGrid />

      {/* Feature Value Props Section inspired by mature doctor discovery apps */}
      <section style={{ backgroundColor: '#ffffff', padding: '3.5rem 0', borderTop: '1px solid var(--border)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--gray-900)' }}>
              Why Patients Trust MediPath
            </h2>
            <p style={{ color: 'var(--gray-500)', marginTop: '0.3rem' }}>
              High standard medical care with verified credentials and seamless access
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '2rem',
            }}
          >
            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <ShieldCheck size={28} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                100% Verified Doctors
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)' }}>
                Medical qualifications and clinic credentials verified by clinical review teams.
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <Video size={28} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Instant Video Consults
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)' }}>
                Connect with specialists from the comfort of your home within minutes.
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <Users size={28} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Real Patient Stories
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)' }}>
                Read authentic feedback and verified recommendations from real clinic visitors.
              </p>
            </div>

            <div style={{ textAlign: 'center', padding: '1rem' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  background: 'var(--primary-light)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem auto',
                }}
              >
                <Clock size={28} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                No Waiting Room Delays
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--gray-600)' }}>
                Pre-scheduled appointments ensure timely consultations without long queues.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
