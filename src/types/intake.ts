/**
 * Medical Intake Conversation Architecture
 * 
 * Defines structured context gathering, red flag detection, 
 * multimodal photo review, and non-diagnostic doctor routing.
 */

export interface MedicalIntakeState {
  chief_complaint: string;
  duration: string;
  progression: string;
  body_location: string;
  severity: string;
  associated_symptoms: string[];
  possible_trigger: string;
  injury: string;
  fever: boolean;
  red_flags: string[];
  image_requested: boolean;
  image_provided: boolean;
  image_preview_url?: string;
  conversation_complete: boolean;
  recommended_specialty: string | null;
  location: string | null;
  reason_for_routing: string | null;
}

export interface IntakeChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  isRedFlagWarning?: boolean;
  suggestedQuickReplies?: string[];
  imagePreviewUrl?: string;
  isRoutingCard?: boolean;
}

export interface StructuredRoutingResult {
  request_type: 'symptom' | 'specialty' | 'doctor' | 'hospital';
  chief_complaint: string;
  specialty: string | null;
  location: string | null;
  query: string;
  doctor_name: string | null;
  hospital_name: string | null;
  confidence: number;
  needs_clarification: boolean;
  clarification_question: string | null;
  red_flags: string[];
  reason_for_routing: string;
}
