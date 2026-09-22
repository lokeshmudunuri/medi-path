import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, ChevronDown, Stethoscope, Sparkles } from 'lucide-react';
import { useLocation } from '../context/LocationContext';
import { SPECIALTIES, DOCTORS } from '../data/mockData';

interface SearchBarProps {
  initialQuery?: string;
  initialLocation?: string;
  onSearch?: (query: string, location: string) => void;
  compact?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  initialQuery = '',
  initialLocation = '',
  onSearch,
  compact = false,
}) => {
  const { selectedLocation, setSelectedLocation, availableLocations, setLocationByName } = useLocation();
  const [query, setQuery] = useState(initialQuery);
  const [locDropdownOpen, setLocDropdownOpen] = useState(false);
  const [locFilterText, setLocFilterText] = useState('');
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialLocation) {
      setLocationByName(initialLocation);
    }
  }, [initialLocation, setLocationByName]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setLocDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSuggestionsOpen(false);

    if (onSearch) {
      onSearch(query, selectedLocation.name);
    } else {
      const params = new URLSearchParams();
      if (selectedLocation.name) params.set('location', selectedLocation.name);
      if (query.trim()) params.set('query', query.trim());
      navigate(`/doctors?${params.toString()}`);
    }
  };

  const handleSpecialtyClick = (specialtyName: string) => {
    setSuggestionsOpen(false);
    navigate(`/doctors?location=${encodeURIComponent(selectedLocation.name)}&specialty=${encodeURIComponent(specialtyName)}`);
  };

  const handleDoctorClick = (doctorId: string) => {
    setSuggestionsOpen(false);
    navigate(`/doctors/${doctorId}`);
  };

  // Filtered cities
  const filteredLocations = availableLocations.filter((loc) =>
    loc.name.toLowerCase().includes(locFilterText.toLowerCase()) ||
    loc.state.toLowerCase().includes(locFilterText.toLowerCase())
  );

  // Suggestions for queries
  const matchingSpecialties = SPECIALTIES.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.symptoms.some((sym) => sym.toLowerCase().includes(query.toLowerCase()))
  ).slice(0, 4);

  const matchingDoctors = DOCTORS.filter(
    (d) =>
      d.locationName.toLowerCase() === selectedLocation.name.toLowerCase() &&
      d.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 3);

  return (
    <form
      className="dual-search-bar"
      onSubmit={handleSearchSubmit}
      style={compact ? { boxShadow: 'none', border: '1px solid var(--border)' } : undefined}
    >
      {/* City / Location Picker */}
      <div className="location-box" ref={dropdownRef}>
        <MapPin className="icon" size={20} />
        <button
          type="button"
          className="location-input-btn"
          id="searchbar-location-btn"
          onClick={() => setLocDropdownOpen(!locDropdownOpen)}
        >
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selectedLocation.name}
          </span>
          <ChevronDown size={16} color="var(--gray-500)" />
        </button>

        {locDropdownOpen && (
          <div className="location-dropdown" id="searchbar-location-dropdown">
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--gray-200)' }}>
              <input
                type="text"
                placeholder="Type city name..."
                value={locFilterText}
                onChange={(e) => setLocFilterText(e.target.value)}
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
                  setLocDropdownOpen(false);
                  setLocFilterText('');
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{loc.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{loc.state}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Query Search Box */}
      <div className="query-search-box">
        <Search className="icon" size={20} />
        <input
          ref={searchInputRef}
          type="text"
          id="main-doctor-search-input"
          className="query-search-input"
          placeholder="Search doctors, specialties, clinics, or symptoms (e.g. fever, skin problem)..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSuggestionsOpen(true);
          }}
          onFocus={() => {
            if (query.trim().length > 0) setSuggestionsOpen(true);
          }}
        />

        {/* Live Search Suggestions Dropdown */}
        {suggestionsOpen && query.trim().length > 1 && (
          <div className="search-suggestions-dropdown" id="search-suggestions-dropdown">
            {matchingSpecialties.length > 0 && (
              <div>
                <div className="suggestion-group-title">Specialties & Symptoms</div>
                {matchingSpecialties.map((spec) => (
                  <div
                    key={spec.id}
                    className="dropdown-item"
                    onClick={() => handleSpecialtyClick(spec.name)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Stethoscope size={16} color="var(--primary)" />
                      <span>{spec.name}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Specialty</span>
                  </div>
                ))}
              </div>
            )}

            {matchingDoctors.length > 0 && (
              <div>
                <div className="suggestion-group-title">Doctors in {selectedLocation.name}</div>
                {matchingDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    className="dropdown-item"
                    onClick={() => handleDoctorClick(doc.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={16} color="var(--accent)" />
                      <span>{doc.name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>({doc.specialty})</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{doc.locality}</span>
                  </div>
                ))}
              </div>
            )}

            {matchingSpecialties.length === 0 && matchingDoctors.length === 0 && (
              <div style={{ padding: '0.75rem 1.25rem', fontSize: '0.9rem', color: 'var(--gray-500)' }}>
                Press Search to look for "{query}" across all listings
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <button type="submit" className="search-submit-btn" id="search-submit-btn">
        <Search size={18} />
        <span>Search</span>
      </button>
    </form>
  );
};
