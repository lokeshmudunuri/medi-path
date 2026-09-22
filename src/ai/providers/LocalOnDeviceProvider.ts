import type { OfflineAIProvider } from '../../types/ai';
import { SPECIALTIES, LOCATIONS } from '../../data/mockData';

/**
 * LocalRuleBasedOfflineProvider
 * 
 * Implements the offline provider boundary using a local rule-based semantic interpreter.
 * 
 * - Zero cloud API calls.
 * - Zero network requests.
 * - Runs 100% locally and synchronously.
 * - In accordance with the Stage 2 specification audit, this is an honest, rule-based 
 *   offline interpreter designed to serve as the development fallback boundary
 *   until a full local model (e.g. WebLLM / ONNX / Wasm LLM) runtime is connected.
 */
export class LocalOnDeviceModelProvider implements OfflineAIProvider {
  public id = 'local-rule-based-offline-v1';
  public name = 'MediPath Offline Semantic Interpreter (Rule-Based)';

  public async isAvailable(): Promise<boolean> {
    // Verified fully available offline
    return true;
  }

  public async processText(userPrompt: string): Promise<string> {
    const trimmed = userPrompt.trim();
    if (!trimmed) {
      return JSON.stringify({
        request_type: 'symptom',
        query: '',
        specialty: null,
        location: null,
        doctor_name: null,
        hospital_name: null,
        confidence: 0,
        needs_clarification: true,
        clarification_question: 'Please describe the symptom, specialty, or doctor you are looking for.',
      });
    }

    const lower = trimmed.toLowerCase();

    // 1. Check for vague or uninterpretable descriptions (Needs Clarification)
    const vaguePhrases = [
      "don't know", "dont know", "don't feel good", "dont feel good", 
      "not feeling well", "feel bad", "help me", "i am sick", "sick", 
      "something wrong", "i need help", "unwell"
    ];
    const isVague = vaguePhrases.some((vp) => lower === vp || lower === `i ${vp}` || lower.includes("just don't feel good"));

    // Check if there are any specific medical keywords present
    const hasSpecificTerm = SPECIALTIES.some((s: { name: string; symptoms: string[] }) => 
      lower.includes(s.name.toLowerCase()) || 
      s.symptoms.some((sym: string) => lower.includes(sym.toLowerCase()))
    ) || lower.includes('dr.') || lower.includes('doctor') || lower.includes('hospital') || lower.includes('clinic');

    if (isVague && !hasSpecificTerm) {
      return JSON.stringify({
        request_type: 'symptom',
        query: trimmed,
        specialty: null,
        location: null,
        doctor_name: null,
        hospital_name: null,
        confidence: 0.2,
        needs_clarification: true,
        clarification_question: 'Could you describe the specific symptoms or body area (e.g. skin, fever, heart, tooth, joint) you want to consult about?',
      });
    }

    // 2. Extract Location if mentioned
    let detectedLocation: string | null = null;
    for (const loc of LOCATIONS) {
      const locNameLower = loc.name.toLowerCase();
      if (lower.includes(locNameLower)) {
        detectedLocation = loc.name;
        break;
      }
    }

    // 3. Extract Doctor Name if mentioned (e.g., "Dr. Ravi", "Dr. Rajesh", "see Dr. Rajesh")
    let detectedDoctor: string | null = null;
    const docMatch = trimmed.match(/Dr\.?\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (docMatch) {
      detectedDoctor = docMatch[0];
    }

    // 4. Extract Hospital Name if mentioned
    let detectedHospital: string | null = null;
    const hospMatch = trimmed.match(/([A-Za-z\s]+)\s+(?:hospital|clinic|care\s+center)/i);
    if (hospMatch) {
      detectedHospital = hospMatch[0].trim();
    }

    // 5. Detect Specialty or Map Symptoms to Specialty
    let detectedSpecialty: string | null = null;
    let requestType: 'symptom' | 'specialty' | 'doctor' | 'hospital' = 'symptom';

    // Direct Specialty Mentions
    const specialtySynonyms: Record<string, string> = {
      'skin doctor': 'Dermatologist',
      'skin specialist': 'Dermatologist',
      'dermatologist': 'Dermatologist',
      'dermatology': 'Dermatologist',
      'heart specialist': 'Cardiologist',
      'heart doctor': 'Cardiologist',
      'cardiologist': 'Cardiologist',
      'cardiology': 'Cardiologist',
      'child specialist': 'Pediatrician',
      'baby doctor': 'Pediatrician',
      'pediatrician': 'Pediatrician',
      'pediatrics': 'Pediatrician',
      'bone doctor': 'Orthopedic',
      'bone specialist': 'Orthopedic',
      'joint specialist': 'Orthopedic',
      'knee': 'Orthopedic',
      'knee pain': 'Orthopedic',
      'knee hurting': 'Orthopedic',
      'joint pain': 'Orthopedic',
      'joint': 'Orthopedic',
      'joints': 'Orthopedic',
      'orthopedic': 'Orthopedic',
      'orthopedics': 'Orthopedic',
      'orthopedist': 'Orthopedic',
      'women doctor': 'Gynecologist',
      'gynecologist': 'Gynecologist',
      'gynaecologist': 'Gynecologist',
      'gynecology': 'Gynecologist',
      'ent': 'ENT Specialist',
      'ear nose throat': 'ENT Specialist',
      'ent specialist': 'ENT Specialist',
      'eye doctor': 'Ophthalmologist',
      'eye specialist': 'Ophthalmologist',
      'ophthalmologist': 'Ophthalmologist',
      'ophthalmology': 'Ophthalmologist',
      'dentist': 'Dentist',
      'dentistry': 'Dentist',
      'dental': 'Dentist',
      'tooth doctor': 'Dentist',
      'tooth pain': 'Dentist',
      'toothache': 'Dentist',
      'tooth hurt': 'Dentist',
      'tooth hurts': 'Dentist',
      'teeth pain': 'Dentist',
      'teeth hurt': 'Dentist',
      'teeth hurts': 'Dentist',
      'gum': 'Dentist',
      'gums': 'Dentist',
      'bleeding gums': 'Dentist',
      'neuro': 'Neurologist',
      'neurologist': 'Neurologist',
      'neurology': 'Neurologist',
      'brain specialist': 'Neurologist',
      'general physician': 'General Physician',
      'general doctor': 'General Physician',
      'physician': 'General Physician',
      'family doctor': 'General Physician',
    };

    for (const [key, spec] of Object.entries(specialtySynonyms)) {
      if (lower.includes(key)) {
        detectedSpecialty = spec;
        requestType = 'specialty';
        break;
      }
    }

    // Symptom-based Mapping if direct specialty was not explicitly found
    if (!detectedSpecialty) {
      for (const spec of SPECIALTIES) {
        const matchedSymptom = spec.symptoms.find((sym: string) => lower.includes(sym.toLowerCase()));
        if (matchedSymptom) {
          detectedSpecialty = spec.name;
          requestType = 'symptom';
          break;
        }
      }
    }

    // If doctor name was explicitly extracted, set request_type
    if (detectedDoctor && !detectedSpecialty) {
      requestType = 'doctor';
    } else if (detectedHospital && !detectedSpecialty && !detectedDoctor) {
      requestType = 'hospital';
    }

    // Determine confidence and clarification
    let confidence = 0.85;
    let needsClarification = false;
    let clarificationQuestion: string | null = null;

    if (!detectedSpecialty && !detectedDoctor && !detectedHospital) {
      // Could not reasonably match
      confidence = 0.3;
      needsClarification = true;
      clarificationQuestion = `We could not match "${trimmed}" with confidence. Could you specify your symptoms or the medical specialist you need?`;
    } else if (detectedSpecialty) {
      confidence = 0.95;
    }

    const structuredOutput = {
      request_type: requestType,
      query: trimmed,
      specialty: detectedSpecialty,
      location: detectedLocation,
      doctor_name: detectedDoctor,
      hospital_name: detectedHospital,
      confidence: confidence,
      needs_clarification: needsClarification,
      clarification_question: clarificationQuestion,
    };

    // Return strictly as formatted JSON string
    return JSON.stringify(structuredOutput, null, 2);
  }
}
