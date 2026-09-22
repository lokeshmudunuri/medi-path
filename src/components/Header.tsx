import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, ChevronDown, Activity, User, ShieldCheck } from 'lucide-react';
import { useLocation } from '../context/LocationContext';

export const Header: React.FC = () => {
  const { selectedLocation, setSelectedLocation, availableLocations } = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredLocations = availableLocations.filter((loc) =>
    loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
    loc.state.toLowerCase().includes(locationSearch.toLowerCase())
  );

  return (
    <header className="header">
      <div className="container header-inner">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <Link to="/" className="logo-link" id="brand-logo">
            <div className="logo-badge">
              <Activity size={22} />
            </div>
            <span>MediPath</span>
          </Link>

          {/* Quick Location Selector in Header */}
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              id="header-location-btn"
              type="button"
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <MapPin size={16} color="var(--primary)" />
              <span>{selectedLocation.name}</span>
              <ChevronDown size={14} />
            </button>

            {dropdownOpen && (
              <div className="location-dropdown" id="header-location-dropdown">
                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--gray-200)' }}>
                  <input
                    type="text"
                    placeholder="Search city..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.85rem',
                      border: '1px solid var(--gray-300)',
                      borderRadius: 'var(--radius-sm)',
                      outline: 'none',
                    }}
                    autoFocus
                  />
                </div>
                {filteredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className={`dropdown-item ${loc.id === selectedLocation.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedLocation(loc);
                      setDropdownOpen(false);
                      setLocationSearch('');
                    }}
                  >
                    <span>{loc.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{loc.state}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          <Link to="/doctors" className="nav-link" id="nav-find-doctors">
            Find Doctors
          </Link>
          <Link
            to="/doctors?consultationType=Video%20Consultation"
            className="nav-link"
            id="nav-video-consult"
          >
            Video Consult
          </Link>
          <Link
            to="/doctor-portal"
            className="nav-link"
            id="nav-doctor-portal"
            style={{ fontWeight: 600, color: 'var(--primary)' }}
          >
            Doctor Portal
          </Link>
        </nav>

        {/* Profile / Action */}
        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={() => alert('User login/profile is available for prototype demo.')}
            id="login-placeholder-btn"
          >
            <User size={16} />
            <span>Login / Signup</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/doctors')}
            id="header-explore-btn"
          >
            <ShieldCheck size={16} />
            <span>Book Doctor</span>
          </button>
        </div>
      </div>
    </header>
  );
};
