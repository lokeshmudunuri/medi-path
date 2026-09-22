import type { Doctor, DoctorSearchParams, Location, Specialty, Hospital } from '../types';
import { DOCTORS, LOCATIONS, SPECIALTIES, HOSPITALS } from '../data/mockData';

/**
 * Reusable doctor search function designed for both manual user filtering
 * and future offline on-device AI structured requests (Stage 2 compatibility).
 *
 * Example Stage 2 input:
 * searchDoctors({
 *   query: "skin rash",
 *   specialty: "Dermatologist",
 *   location: "Bhimavaram"
 * })
 */
export function searchDoctors(params: DoctorSearchParams): Doctor[] {
  const {
    query = '',
    specialty = '',
    location = '',
    experienceMin,
    consultationFeeMax,
    consultationType,
    gender,
    sortBy = 'relevance'
  } = params;

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedSpecialty = specialty.trim().toLowerCase();
  const normalizedLocation = location.trim().toLowerCase();

  // 1. Identify if query maps to a known specialty's symptoms or name
  let matchedSpecialtyNames: string[] = [];
  if (normalizedQuery) {
    matchedSpecialtyNames = SPECIALTIES
      .filter((s) => 
        s.name.toLowerCase().includes(normalizedQuery) ||
        s.symptoms.some((sym) => normalizedQuery.includes(sym.toLowerCase()) || sym.toLowerCase().includes(normalizedQuery))
      )
      .map((s) => s.name.toLowerCase());
  }

  // 2. Filter doctors
  let results = DOCTORS.filter((doctor) => {
    // Location filter
    if (normalizedLocation) {
      const matchCity = doctor.locationName.toLowerCase() === normalizedLocation ||
                        doctor.locationName.toLowerCase().includes(normalizedLocation);
      const matchLocality = doctor.locality.toLowerCase().includes(normalizedLocation);
      if (!matchCity && !matchLocality) {
        return false;
      }
    }

    // Direct Specialty filter
    if (normalizedSpecialty) {
      const matchSpec = doctor.specialty.toLowerCase() === normalizedSpecialty ||
                        doctor.specialty.toLowerCase().includes(normalizedSpecialty);
      if (!matchSpec) {
        return false;
      }
    }

    // Free-form Query filter (Doctor name, specialty, qualifications, services, symptoms)
    if (normalizedQuery) {
      const matchName = doctor.name.toLowerCase().includes(normalizedQuery);
      const matchSpec = doctor.specialty.toLowerCase().includes(normalizedQuery);
      const matchQual = doctor.qualifications.toLowerCase().includes(normalizedQuery);
      const matchHospital = doctor.hospitalName.toLowerCase().includes(normalizedQuery);
      const matchServices = doctor.services.some((srv) => srv.toLowerCase().includes(normalizedQuery));
      const matchSymptomSpec = matchedSpecialtyNames.includes(doctor.specialty.toLowerCase());

      if (!matchName && !matchSpec && !matchQual && !matchHospital && !matchServices && !matchSymptomSpec) {
        return false;
      }
    }

    // Minimum experience filter
    if (experienceMin !== undefined && doctor.experience < experienceMin) {
      return false;
    }

    // Max consultation fee filter
    if (consultationFeeMax !== undefined && doctor.consultationFee > consultationFeeMax) {
      return false;
    }

    // Consultation type filter (In-Clinic or Video Consultation)
    if (consultationType && !doctor.consultationTypes.includes(consultationType)) {
      return false;
    }

    // Gender filter
    if (gender && doctor.gender !== gender) {
      return false;
    }

    return true;
  });

  // 3. Sort results
  results = [...results].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'experience':
        return b.experience - a.experience;
      case 'fee-low':
        return a.consultationFee - b.consultationFee;
      case 'fee-high':
        return b.consultationFee - a.consultationFee;
      case 'relevance':
      default:
        // Priority to higher rating & experience
        return b.rating * 10 + b.experience - (a.rating * 10 + a.experience);
    }
  });

  return results;
}

export function getDoctorById(id: string): Doctor | undefined {
  return DOCTORS.find((doc) => doc.id === id);
}

export function getSpecialties(): Specialty[] {
  return SPECIALTIES;
}

export function getLocations(): Location[] {
  return LOCATIONS;
}

export function getHospitals(): Hospital[] {
  return HOSPITALS;
}

export function getLocationByName(name: string): Location | undefined {
  return LOCATIONS.find(
    (loc) => loc.name.toLowerCase() === name.toLowerCase()
  );
}
