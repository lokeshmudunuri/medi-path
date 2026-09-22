import type { StructuredAIRequest } from '../types/ai';
import type { DoctorSearchParams, Doctor } from '../types';
import { searchDoctors } from './searchService';

/**
 * Maps a validated, normalized StructuredAIRequest into the existing DoctorSearchParams.
 * This directly reuses the existing Stage 1 searchDoctors() function.
 */
export function mapStructuredRequestToSearchParams(
  request: StructuredAIRequest,
  fallbackLocation?: string
): DoctorSearchParams {
  const params: DoctorSearchParams = {
    // If a specific doctor name is extracted, use it as query
    query: request.doctor_name || (request.request_type === 'symptom' ? request.query : undefined),
    specialty: request.specialty || undefined,
    // Use extracted location, or fallback to current selected city
    location: request.location || fallbackLocation || undefined,
    sortBy: 'relevance',
  };

  return params;
}

/**
 * Executes doctor discovery using the structured request and the existing search system.
 */
export function discoverDoctorsFromAI(
  request: StructuredAIRequest,
  currentLocation?: string
): Doctor[] {
  const searchParams = mapStructuredRequestToSearchParams(request, currentLocation);
  return searchDoctors(searchParams);
}
