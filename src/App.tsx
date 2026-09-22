import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LocationProvider } from './context/LocationContext';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { DoctorListPage } from './pages/DoctorListPage';
import { DoctorProfilePage } from './pages/DoctorProfilePage';
import { BookingPage } from './pages/BookingPage';
import { ConfirmationPage } from './pages/ConfirmationPage';
import { ClinicQueueDashboardPage } from './pages/ClinicQueueDashboardPage';

import { DoctorPortalPage } from './pages/DoctorPortalPage';
import { PartBPlaceholder } from './features/partB/PartBPlaceholder';

export function App() {
  return (
    <BrowserRouter>
      <LocationProvider>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          <Header />
          <div style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/doctors" element={<DoctorListPage />} />
              <Route path="/doctors/:doctorId" element={<DoctorProfilePage />} />
              <Route path="/booking/:doctorId" element={<BookingPage />} />
              <Route path="/booking/confirmation/:appointmentId" element={<ConfirmationPage />} />
              <Route path="/queue/:doctorId" element={<ClinicQueueDashboardPage />} />
              <Route path="/doctor-portal" element={<DoctorPortalPage />} />
              <Route path="/part-b" element={<PartBPlaceholder />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <footer
            style={{
              backgroundColor: '#1e293b',
              color: '#94a3b8',
              padding: '2.5rem 0',
              marginTop: 'auto',
              borderTop: '1px solid #334155',
            }}
          >
            <div className="container" style={{ textAlign: 'center', fontSize: '0.88rem' }}>
              <p style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '0.4rem' }}>
                MediPath Doctor Discovery Platform
              </p>
              <p style={{ marginBottom: '0.6rem' }}>
                Stage 1 Prototype • Centralized Doctor Discovery, Specialty Index & Practitioner Profiles
              </p>
              <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Disclaimer: All doctor information, hospital listings, and clinic affiliations shown are realistic mock data for prototype demonstration.
              </p>
            </div>
          </footer>
        </div>
      </LocationProvider>
    </BrowserRouter>
  );
}

export default App;
