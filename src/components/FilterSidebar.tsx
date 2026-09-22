import React from 'react';
import type { ConsultationType } from '../types';
import { SPECIALTIES } from '../data/mockData';

interface FilterSidebarProps {
  specialty: string;
  setSpecialty: (val: string) => void;
  experienceMin: number | undefined;
  setExperienceMin: (val: number | undefined) => void;
  consultationFeeMax: number | undefined;
  setConsultationFeeMax: (val: number | undefined) => void;
  consultationType: ConsultationType | undefined;
  setConsultationType: (val: ConsultationType | undefined) => void;
  gender: 'Male' | 'Female' | undefined;
  setGender: (val: 'Male' | 'Female' | undefined) => void;
  onReset: () => void;
}

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  specialty,
  setSpecialty,
  experienceMin,
  setExperienceMin,
  consultationFeeMax,
  setConsultationFeeMax,
  consultationType,
  setConsultationType,
  gender,
  setGender,
  onReset,
}) => {
  return (
    <aside className="filter-sidebar" id="filter-sidebar">
      <div className="filter-header">
        <span className="filter-title">All Filters</span>
        <button
          type="button"
          className="filter-reset-btn"
          id="filter-reset-btn"
          onClick={onReset}
        >
          Reset All
        </button>
      </div>

      {/* Specialty Filter */}
      <div className="filter-group">
        <div className="filter-group-title">Specialty</div>
        <select
          id="filter-specialty-select"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          style={{
            width: '100%',
            padding: '0.45rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--gray-300)',
            fontSize: '0.85rem',
          }}
        >
          <option value="">All Specialties</option>
          {SPECIALTIES.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Consultation Type */}
      <div className="filter-group">
        <div className="filter-group-title">Consultation Mode</div>
        <label className="filter-option">
          <input
            type="radio"
            name="consultationMode"
            checked={consultationType === undefined}
            onChange={() => setConsultationType(undefined)}
          />
          <span>All Modes</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="consultationMode"
            checked={consultationType === 'In-Clinic'}
            onChange={() => setConsultationType('In-Clinic')}
          />
          <span>In-Clinic Visit</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="consultationMode"
            checked={consultationType === 'Video Consultation'}
            onChange={() => setConsultationType('Video Consultation')}
          />
          <span>Video Consultation</span>
        </label>
      </div>

      {/* Max Consultation Fee */}
      <div className="filter-group">
        <div className="filter-group-title">Max Consultation Fee</div>
        <label className="filter-option">
          <input
            type="radio"
            name="consultFee"
            checked={consultationFeeMax === undefined}
            onChange={() => setConsultationFeeMax(undefined)}
          />
          <span>Any Fee</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="consultFee"
            checked={consultationFeeMax === 400}
            onChange={() => setConsultationFeeMax(400)}
          />
          <span>Up to ₹400</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="consultFee"
            checked={consultationFeeMax === 700}
            onChange={() => setConsultationFeeMax(700)}
          />
          <span>Up to ₹700</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="consultFee"
            checked={consultationFeeMax === 1000}
            onChange={() => setConsultationFeeMax(1000)}
          />
          <span>Up to ₹1000</span>
        </label>
      </div>

      {/* Minimum Experience */}
      <div className="filter-group">
        <div className="filter-group-title">Experience</div>
        <label className="filter-option">
          <input
            type="radio"
            name="experienceYears"
            checked={experienceMin === undefined}
            onChange={() => setExperienceMin(undefined)}
          />
          <span>Any Experience</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="experienceYears"
            checked={experienceMin === 5}
            onChange={() => setExperienceMin(5)}
          />
          <span>5+ Years</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="experienceYears"
            checked={experienceMin === 10}
            onChange={() => setExperienceMin(10)}
          />
          <span>10+ Years</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="experienceYears"
            checked={experienceMin === 15}
            onChange={() => setExperienceMin(15)}
          />
          <span>15+ Years</span>
        </label>
      </div>

      {/* Gender */}
      <div className="filter-group">
        <div className="filter-group-title">Doctor Gender</div>
        <label className="filter-option">
          <input
            type="radio"
            name="gender"
            checked={gender === undefined}
            onChange={() => setGender(undefined)}
          />
          <span>Any Gender</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="gender"
            checked={gender === 'Male'}
            onChange={() => setGender('Male')}
          />
          <span>Male Doctor</span>
        </label>
        <label className="filter-option">
          <input
            type="radio"
            name="gender"
            checked={gender === 'Female'}
            onChange={() => setGender('Female')}
          />
          <span>Female Doctor</span>
        </label>
      </div>
    </aside>
  );
};
