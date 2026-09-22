import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchBar } from '../components/SearchBar';
import { DoctorCard } from '../components/DoctorCard';
import { FilterSidebar } from '../components/FilterSidebar';
import { searchDoctors } from '../services/searchService';
import type { ConsultationType, Doctor } from '../types';
import { useLocation } from '../context/LocationContext';
import { AlertCircle, ArrowUpDown } from 'lucide-react';

export const DoctorListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedLocation, setLocationByName } = useLocation();

  // Search parameters from URL
  const urlSpecialty = searchParams.get('specialty') || '';
  const urlQuery = searchParams.get('query') || '';
  const urlConsultType = (searchParams.get('consultationType') as ConsultationType) || undefined;

  // Sync Location Context with URL if param given
  useEffect(() => {
    if (searchParams.get('location')) {
      setLocationByName(searchParams.get('location')!);
    }
  }, [searchParams, setLocationByName]);

  // Local filter states
  const [specialty, setSpecialty] = useState<string>(urlSpecialty);
  const [query, setQuery] = useState<string>(urlQuery);
  const [experienceMin, setExperienceMin] = useState<number | undefined>(undefined);
  const [consultationFeeMax, setConsultationFeeMax] = useState<number | undefined>(undefined);
  const [consultationType, setConsultationType] = useState<ConsultationType | undefined>(urlConsultType);
  const [gender, setGender] = useState<'Male' | 'Female' | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'relevance' | 'experience' | 'fee-low' | 'fee-high' | 'rating'>('relevance');

  // Sync state if URL changes (e.g. user clicks specialty from homepage)
  useEffect(() => {
    setSpecialty(urlSpecialty);
  }, [urlSpecialty]);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (urlConsultType) setConsultationType(urlConsultType);
  }, [urlConsultType]);

  // Execute clean search service
  const filteredDoctors: Doctor[] = useMemo(() => {
    return searchDoctors({
      location: selectedLocation.name,
      specialty: specialty || undefined,
      query: query || undefined,
      experienceMin,
      consultationFeeMax,
      consultationType,
      gender,
      sortBy,
    });
  }, [selectedLocation.name, specialty, query, experienceMin, consultationFeeMax, consultationType, gender, sortBy]);

  const handleResetFilters = () => {
    setSpecialty('');
    setQuery('');
    setExperienceMin(undefined);
    setConsultationFeeMax(undefined);
    setConsultationType(undefined);
    setGender(undefined);
    setSortBy('relevance');
    setSearchParams({ location: selectedLocation.name });
  };

  const handleSearchSubmit = (newQuery: string, newLocation: string) => {
    setQuery(newQuery);
    const params = new URLSearchParams();
    params.set('location', newLocation);
    if (newQuery) params.set('query', newQuery);
    if (specialty) params.set('specialty', specialty);
    setSearchParams(params);
  };

  return (
    <div id="doctor-list-page">
      {/* Top Search Bar */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid var(--border)', padding: '1.25rem 0' }}>
        <div className="container">
          <SearchBar
            compact
            initialQuery={query}
            initialLocation={selectedLocation.name}
            onSearch={handleSearchSubmit}
          />
        </div>
      </div>

      {/* Main Listing View */}
      <div className="container">
        <div className="doctor-listing-layout">
          {/* Left: Filter Sidebar */}
          <FilterSidebar
            specialty={specialty}
            setSpecialty={(val) => {
              setSpecialty(val);
              const p = new URLSearchParams(searchParams);
              if (val) p.set('specialty', val);
              else p.delete('specialty');
              setSearchParams(p);
            }}
            experienceMin={experienceMin}
            setExperienceMin={setExperienceMin}
            consultationFeeMax={consultationFeeMax}
            setConsultationFeeMax={setConsultationFeeMax}
            consultationType={consultationType}
            setConsultationType={setConsultationType}
            gender={gender}
            setGender={setGender}
            onReset={handleResetFilters}
          />

          {/* Right: Results List */}
          <main className="doctor-results-col" id="doctor-results-col">
            <div className="results-topbar">
              <div>
                <h1 className="results-count" id="results-count-heading">
                  {filteredDoctors.length} {specialty || 'Doctors'} available in {selectedLocation.name}
                </h1>
                {query && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.2rem' }}>
                    Matching keyword or symptom: "<strong>{query}</strong>"
                  </p>
                )}
              </div>

              {/* Sort By Dropdown */}
              <div className="sort-select-box">
                <ArrowUpDown size={15} color="var(--gray-500)" />
                <label htmlFor="sort-doctors-select">Sort by:</label>
                <select
                  id="sort-doctors-select"
                  className="sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="rating">Rating: High to Low</option>
                  <option value="experience">Experience: Most Experienced</option>
                  <option value="fee-low">Price: Low to High</option>
                  <option value="fee-high">Price: High to Low</option>
                </select>
              </div>
            </div>

            {/* List or Empty State */}
            {filteredDoctors.length > 0 ? (
              <div id="doctors-list-container">
                {filteredDoctors.map((doc) => (
                  <DoctorCard key={doc.id} doctor={doc} />
                ))}
              </div>
            ) : (
              <div className="empty-state" id="empty-results-box">
                <AlertCircle size={44} color="var(--gray-400)" style={{ margin: '0 auto' }} />
                <h3 className="empty-state-title">No doctors found matching your criteria</h3>
                <p className="empty-state-sub">
                  Try clearing some filters or searching for doctors in another city.
                </p>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ marginTop: '1.25rem' }}
                  onClick={handleResetFilters}
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
