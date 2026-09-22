/**
 * Structured AI Request Schema
 * 
 * Strict logical structure required by MediPath Part A - Stage 2.
 * The offline AI converts natural-language user descriptions into this structured format,
 * which is then validated and mapped to the existing doctor search system.
 */
export type StructuredRequestType = 'symptom' | 'specialty' | 'doctor' | 'hospital';

export interface StructuredAIRequest {
  request_type: StructuredRequestType;
  query: string;
  specialty: string | null;
  location: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  confidence: number;
  needs_clarification: boolean;
  clarification_question?: string | null;
}

export interface AIInterpretationResult {
  rawResponse?: string;
  structuredRequest: StructuredAIRequest;
  validationErrors?: string[];
  isValid: boolean;
}

export interface OfflineAIProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  processText(prompt: string): Promise<string>;
  
  // Model Lifecycle & Multimodal Extensions for Gemma Architecture
  initialize?(): Promise<boolean>;
  generate?(prompt: string): Promise<string>;
  generateWithImage?(prompt: string, imageBase64OrUrl: string): Promise<string>;
  getRuntimeMode?(): 'ANDROID_ON_DEVICE' | 'DEV_MODE' | 'FALLBACK_ACTIVE';
}

/**
 * Strict Allowed Intent Types for Gemma 3 1B IT On-Device Intake
 */
export type AllowedAIIntent =
  | 'find_doctor'
  | 'doctor_information'
  | 'hospital_information'
  | 'appointment_information'
  | 'appointment_booking_request'
  | 'general_health_question'
  | 'clarification_needed'
  | 'emergency_warning'
  | 'unsupported_request';

/**
 * Strict Structured Output for Gemma 3 1B INT4 Mobile Model
 * NOTE: LLM is strictly prohibited from generating fake clinical confidence values (e.g. 0.95).
 */
export interface Gemma3StructuredIntakeOutput {
  intent: AllowedAIIntent;
  specialty: string | null;
  complaint: string;
  duration: string | null;
  body_area: string | null;
  location: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  needs_clarification: boolean;
  clarification_question: string | null;
  response: string;
}
