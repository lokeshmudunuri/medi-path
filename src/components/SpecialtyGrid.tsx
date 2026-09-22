import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Stethoscope, 
  Sparkles, 
  HeartPulse, 
  Baby, 
  Activity, 
  UserCheck, 
  Ear, 
  Eye, 
  Smile, 
  Brain 
} from 'lucide-react';
import { SPECIALTIES } from '../data/mockData';
import { useLocation } from '../context/LocationContext';

const ICON_MAP: Record<string, React.ReactNode> = {
  Stethoscope: <Stethoscope size={28} />,
  Sparkles: <Sparkles size={28} />,
  HeartPulse: <HeartPulse size={28} />,
  Baby: <Baby size={28} />,
  Activity: <Activity size={28} />,
  UserCheck: <UserCheck size={28} />,
  Ear: <Ear size={28} />,
  Eye: <Eye size={28} />,
  Smile: <Smile size={28} />,
  Brain: <Brain size={28} />,
};

export const SpecialtyGrid: React.FC = () => {
  const navigate = useNavigate();
  const { selectedLocation } = useLocation();

  const handleSpecialtySelect = (specialtyName: string) => {
    navigate(`/doctors?location=${encodeURIComponent(selectedLocation.name)}&specialty=${encodeURIComponent(specialtyName)}`);
  };

  return (
    <section className="specialties-section" id="specialties-section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Consult Top Doctors by Specialty</h2>
          <p className="section-subtitle">
            Book in-clinic or video consultations with verified specialists in {selectedLocation.name}
          </p>
        </div>

        <div className="specialties-grid">
          {SPECIALTIES.map((spec) => (
            <div
              key={spec.id}
              className="specialty-card"
              id={`specialty-card-${spec.id}`}
              onClick={() => handleSpecialtySelect(spec.name)}
            >
              <div className="specialty-icon-wrapper">
                {ICON_MAP[spec.iconName] || <Stethoscope size={28} />}
              </div>
              <h3 className="specialty-name">{spec.name}</h3>
              <p className="specialty-desc">{spec.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
