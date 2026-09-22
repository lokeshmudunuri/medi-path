import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, MapPin, Building2, Clock, Video } from 'lucide-react';
import type { Doctor } from '../types';

interface DoctorCardProps {
  doctor: Doctor;
  onBookClick?: (doctor: Doctor) => void;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({ doctor, onBookClick }) => {
  const navigate = useNavigate();

  const handleBook = () => {
    if (onBookClick) {
      onBookClick(doctor);
    } else {
      navigate(`/booking/${doctor.id}`);
    }
  };

  return (
    <div className="doctor-card" id={`doctor-card-${doctor.id}`}>
      {/* Avatar */}
      <div className="doctor-avatar-wrap">
        <img
          src={doctor.avatarUrl}
          alt={doctor.name}
          className="doctor-avatar"
          loading="lazy"
        />
      </div>

      {/* Main Info */}
      <div className="doctor-info-main">
        <Link to={`/doctors/${doctor.id}`}>
          <h3 className="doc-name">{doctor.name}</h3>
        </Link>
        <div className="doc-specialty">{doctor.specialty}</div>
        <div className="doc-qualification">{doctor.qualifications}</div>
        <div className="doc-experience">{doctor.experience} years experience overall</div>

        <div className="doc-hospital">
          <Building2 size={15} color="var(--gray-500)" />
          <span>{doctor.hospitalName}</span>
        </div>

        <div className="doc-hospital">
          <MapPin size={15} color="var(--gray-500)" />
          <span>
            {doctor.locality}, {doctor.locationName}
          </span>
        </div>

        {/* Consultation Types */}
        <div className="doc-types">
          {doctor.consultationTypes.map((type) => (
            <span key={type} className="tag-badge">
              {type === 'Video Consultation' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Video size={12} /> {type}
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <Building2 size={12} /> {type}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Right Action Column */}
      <div className="doctor-card-action">
        <div style={{ textAlign: 'right' }}>
          <div className="doc-rating-badge">
            <Star size={13} fill="#ffffff" />
            <span>{doctor.rating.toFixed(1)}</span>
          </div>
          <div className="doc-reviews-count">{doctor.reviewCount} Patient Stories</div>
        </div>

        <div className="doc-fee">
          <div className="fee-val">₹{doctor.consultationFee}</div>
          <div className="fee-sub">Consultation fee at clinic</div>
        </div>

        <div className="doc-availability">
          <Clock size={13} />
          <span>Available {doctor.availability.nextAvailable}</span>
        </div>

        <div className="action-btn-group">
          <button
            type="button"
            className="btn-book"
            id={`book-btn-${doctor.id}`}
            onClick={handleBook}
          >
            Book Appointment
          </button>
          <Link
            to={`/doctors/${doctor.id}`}
            className="btn-profile"
            id={`profile-btn-${doctor.id}`}
          >
            View Profile
          </Link>
        </div>
      </div>
    </div>
  );
};
