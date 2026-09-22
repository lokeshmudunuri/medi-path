import type { StructuredAIRequest } from '../types/ai';
import { SPECIALTIES, LOCATIONS } from '../data/mockData';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data: StructuredAIRequest | null;
}

const ALLOWED_REQUEST_TYPES = ['symptom', 'specialty', 'doctor', 'hospital'] as const;
const ALLOWED_INTENTS = [
  'find_doctor',
  'doctor_information',
  'hospital_information',
  'appointment_information',
  'appointment_booking_request',
  'general_health_question',
  'clarification_needed',
  'emergency_warning',
  'unsupported_request'
] as const;

/**
 * Validates raw parsed JSON against the strict StructuredAIRequest schema.
 * Supports both legacy StructuredAIRequest and Gemma 3 1B INT4 Mobile Intent schema.
 * Rejects invalid types, malformed structures, and sanitizes fields.
 */
export function validateStructuredRequest(rawJson: unknown): ValidationResult {
  const errors: string[] = [];

  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
    return {
      isValid: false,
      errors: ['AI response must be a valid JSON object.'],
      data: null,
    };
  }

  const obj = rawJson as Record<string, unknown>;

  // Detect Schema: Gemma 3 Intent-based vs legacy request_type
  let requestType: 'symptom' | 'specialty' | 'doctor' | 'hospital' = 'symptom';
  const rawQuery = (obj.query as string) || (obj.complaint as string) || '';

  if (obj.intent && typeof obj.intent === 'string') {
    if (!ALLOWED_INTENTS.includes(obj.intent as any)) {
      errors.push(`Invalid intent "${obj.intent}". Allowed intents: ${ALLOWED_INTENTS.join(', ')}`);
    } else {
      if (obj.intent === 'find_doctor') {
        requestType = obj.specialty ? 'specialty' : 'symptom';
      } else if (obj.intent === 'doctor_information') {
        requestType = 'doctor';
      } else if (obj.intent === 'hospital_information') {
        requestType = 'hospital';
      } else {
        requestType = 'symptom';
      }
    }
  } else if (!obj.request_type || typeof obj.request_type !== 'string') {
    errors.push('Missing or invalid "intent" or "request_type".');
  } else if (!ALLOWED_REQUEST_TYPES.includes(obj.request_type as any)) {
    errors.push(`Invalid request_type "${obj.request_type}". Allowed types: ${ALLOWED_REQUEST_TYPES.join(', ')}`);
  } else {
    requestType = obj.request_type as any;
  }

  // 2. Validate query / complaint
  if (!rawQuery && typeof rawQuery !== 'string') {
    errors.push('"query" or "complaint" must be a string.');
  }

  // 3. Validate specialty (string or null)
  if (obj.specialty !== null && typeof obj.specialty !== 'string' && obj.specialty !== undefined) {
    errors.push('"specialty" must be a string or null.');
  }

  // 4. Validate location (string or null)
  if (obj.location !== null && typeof obj.location !== 'string' && obj.location !== undefined) {
    errors.push('"location" must be a string or null.');
  }

  // 5. Validate doctor_name (string or null)
  if (obj.doctor_name !== null && typeof obj.doctor_name !== 'string' && obj.doctor_name !== undefined) {
    errors.push('"doctor_name" must be a string or null.');
  }

  // 6. Validate hospital_name (string or null)
  if (obj.hospital_name !== null && typeof obj.hospital_name !== 'string' && obj.hospital_name !== undefined) {
    errors.push('"hospital_name" must be a string or null.');
  }

  // 7. Validate confidence (number between 0 and 1)
  let confidence = typeof obj.confidence === 'number' ? obj.confidence : 0;
  if (confidence < 0 || confidence > 1 || isNaN(confidence)) {
    confidence = Math.max(0, Math.min(1, confidence || 0));
  }

  // 8. Validate needs_clarification
  const needsClarification = Boolean(obj.needs_clarification);

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      data: null,
    };
  }

  // Canonical normalization against Stage 1 dataset
  let canonicalSpecialty: string | null = null;
  if (typeof obj.specialty === 'string' && obj.specialty.trim().length > 0) {
    const rawSpec = obj.specialty.trim().toLowerCase();
    // Check direct name match
    const matchedSpec = SPECIALTIES.find((s) => s.name.toLowerCase() === rawSpec);
    if (matchedSpec) {
      canonicalSpecialty = matchedSpec.name;
    } else {
      // Map common variants (e.g., 'dermatology' -> 'Dermatologist', 'cardiology' -> 'Cardiologist', 'dentistry' -> 'Dentist')
      const canonicalMap: Record<string, string> = {
        'dermatology': 'Dermatologist',
        'dermatologist': 'Dermatologist',
        'cardiology': 'Cardiologist',
        'cardiologist': 'Cardiologist',
        'pediatrics': 'Pediatrician',
        'pediatrician': 'Pediatrician',
        'orthopedics': 'Orthopedic',
        'orthopedic': 'Orthopedic',
        'gynecology': 'Gynecologist',
        'gynecologist': 'Gynecologist',
        'ent': 'ENT Specialist',
        'ent specialist': 'ENT Specialist',
        'ophthalmology': 'Ophthalmologist',
        'ophthalmologist': 'Ophthalmologist',
        'dentistry': 'Dentist',
        'dentist': 'Dentist',
        'neurology': 'Neurologist',
        'neurologist': 'Neurologist',
        'general medicine': 'General Physician',
        'internal medicine': 'General Physician',
        'general physician': 'General Physician',
      };
      canonicalSpecialty = canonicalMap[rawSpec] || obj.specialty.trim();
    }
  }

  let canonicalLocation: string | null = null;
  if (typeof obj.location === 'string' && obj.location.trim().length > 0) {
    const rawLoc = obj.location.trim().toLowerCase();
    const matchedLoc = LOCATIONS.find((l) => l.name.toLowerCase() === rawLoc);
    canonicalLocation = matchedLoc ? matchedLoc.name : obj.location.trim();
  }

  const cleanDoctorName = typeof obj.doctor_name === 'string' && obj.doctor_name.trim().length > 0
    ? obj.doctor_name.trim()
    : null;

  const cleanHospitalName = typeof obj.hospital_name === 'string' && obj.hospital_name.trim().length > 0
    ? obj.hospital_name.trim()
    : null;

  const cleanClarification = typeof obj.clarification_question === 'string' && obj.clarification_question.trim().length > 0
    ? obj.clarification_question.trim()
    : null;

  const normalized: StructuredAIRequest = {
    request_type: requestType,
    query: rawQuery.trim(),
    specialty: canonicalSpecialty,
    location: canonicalLocation,
    doctor_name: cleanDoctorName,
    hospital_name: cleanHospitalName,
    confidence: Number(confidence.toFixed(2)),
    needs_clarification: needsClarification,
    clarification_question: cleanClarification,
  };

  return {
    isValid: true,
    errors: [],
    data: normalized,
  };
}

/**
 * Safely parses raw text from the AI model into a validated StructuredAIRequest.
 * Extracts JSON even if enclosed in markdown code fences.
 */
export function parseAndValidateAIResponse(rawText: string): ValidationResult {
  if (!rawText || !rawText.trim()) {
    return {
      isValid: false,
      errors: ['Empty response from offline AI model.'],
      data: null,
    };
  }

  let textToParse = rawText.trim();

  // Strip markdown code fences if model wrapped response in ```json ... ```
  const codeBlockMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    textToParse = codeBlockMatch[1].trim();
  } else {
    // If there is extraneous text before or after the JSON, extract the JSON object block
    const firstBrace = textToParse.indexOf('{');
    const lastBrace = textToParse.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      textToParse = textToParse.substring(firstBrace, lastBrace + 1);
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textToParse);
  } catch (err: any) {
    return {
      isValid: false,
      errors: [`Failed to parse JSON from AI model: ${err.message || 'Malformed JSON'}`],
      data: null,
    };
  }

  return validateStructuredRequest(parsed);
}
