import type { MedicalIntakeState, IntakeChatMessage, StructuredRoutingResult } from '../types/intake';

/**
 * ConversationalIntakeEngine
 * 
 * Conducts structured, empathetic medical intake without making clinical diagnoses.
 * Gathers context: duration, progression, location, triggers, fever, and red flags.
 * Requests optional visible image when appropriate (rashes, swelling, cuts, bites).
 * Produces a safe, non-diagnostic reason_for_routing for doctor discovery.
 */
export class ConversationalIntakeEngine {
  public static createInitialState(userLocation?: string): MedicalIntakeState {
    return {
      chief_complaint: '',
      duration: '',
      progression: '',
      body_location: '',
      severity: '',
      associated_symptoms: [],
      possible_trigger: '',
      injury: '',
      fever: false,
      red_flags: [],
      image_requested: false,
      image_provided: false,
      conversation_complete: false,
      recommended_specialty: null,
      location: userLocation || null,
      reason_for_routing: null,
    };
  }

  /**
   * Evaluates dangerous/urgent symptoms
   */
  public static checkRedFlags(text: string): string[] {
    const lower = text.toLowerCase();
    const flags: string[] = [];

    if (
      lower.includes('difficulty breathing') ||
      lower.includes('shortness of breath') ||
      lower.includes('cannot breathe') ||
      lower.includes('gasping')
    ) {
      flags.push('Difficulty breathing');
    }
    if (
      lower.includes('swelling of lip') ||
      lower.includes('swelling of lips') ||
      lower.includes('tongue swelling') ||
      lower.includes('throat closing') ||
      lower.includes('face swelling')
    ) {
      flags.push('Severe facial/throat swelling (Potential anaphylaxis)');
    }
    if (
      lower.includes('chest pain') ||
      lower.includes('chest pressure') ||
      lower.includes('radiating to arm')
    ) {
      flags.push('Severe chest pain');
    }
    if (
      lower.includes('fainting') ||
      lower.includes('passed out') ||
      lower.includes('loss of consciousness')
    ) {
      flags.push('Loss of consciousness / fainting');
    }
    if (
      lower.includes('severe bleeding') ||
      lower.includes('bleeding heavily') ||
      lower.includes('blood vomiting')
    ) {
      flags.push('Severe bleeding');
    }

    return flags;
  }

  /**
   * Evaluates user response and determines next question or routing outcome.
   */
  public static processTurn(
    userInput: string,
    state: MedicalIntakeState,
    conversationHistory: IntakeChatMessage[]
  ): {
    nextMessage: IntakeChatMessage;
    updatedState: MedicalIntakeState;
    routingResult?: StructuredRoutingResult;
  } {
    const updatedState = { ...state };
    const text = userInput.trim();
    const lower = text.toLowerCase();

    // 1. First user message: Store chief complaint
    if (!updatedState.chief_complaint) {
      updatedState.chief_complaint = text;
    }

    // 2. Check for Red Flags (Urgent Emergency Symptoms)
    const detectedFlags = this.checkRedFlags(text);
    if (detectedFlags.length > 0) {
      updatedState.red_flags = Array.from(new Set([...updatedState.red_flags, ...detectedFlags]));
      
      const urgentMsg: IntakeChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **URGENT MEDICAL WARNING**: Your symptoms (${updatedState.red_flags.join(', ')}) may indicate a serious medical emergency. Please visit the nearest Emergency Room or call 108/112 immediately. If you have someone nearby, inform them right away.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRedFlagWarning: true,
      };

      return {
        nextMessage: urgentMsg,
        updatedState,
      };
    }

    // 2b. Guardrail: User asks for diagnosis (Test 5: "What disease do I have?")
    if (
      lower.includes('what disease do i have') ||
      lower.includes('what disease') ||
      lower.includes('diagnose me') ||
      lower.includes('tell me what illness') ||
      lower.includes('do i have cancer') ||
      lower.includes('what is my diagnosis')
    ) {
      const noDiagnosisMsg: IntakeChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: 'I am MediPath\'s AI intake assistant. I am not a doctor and cannot diagnose diseases or medical conditions. I can help identify an appropriate medical specialist and assist you in finding qualified doctors based on the symptoms you describe.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      return {
        nextMessage: noDiagnosisMsg,
        updatedState,
      };
    }

    // 2c. Guardrail: User asks about stopping or altering medication (Test 6: "Can I stop my medicine?")
    if (
      lower.includes('stop my medicine') ||
      lower.includes('stop taking') ||
      lower.includes('change my dosage') ||
      lower.includes('skip my pill') ||
      lower.includes('stop my medication')
    ) {
      const noMedicationMsg: IntakeChatMessage = {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: 'You should never stop, pause, or adjust your prescribed medication without consulting your treating doctor or pharmacist. Please speak with your healthcare provider before making any changes to your medication regimen.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      return {
        nextMessage: noMedicationMsg,
        updatedState,
      };
    }

    // 3. Extract features from current input
    if (lower.includes('day') || lower.includes('week') || lower.includes('month') || lower.includes('hour') || lower.includes('yesterday') || lower.includes('since')) {
      if (!updatedState.duration) updatedState.duration = text;
    }
    if (lower.includes('bite') || lower.includes('mosquito') || lower.includes('insect') || lower.includes('fall') || lower.includes('hit') || lower.includes('accident')) {
      if (!updatedState.possible_trigger) updatedState.possible_trigger = text;
    }
    if (lower.includes('arm') || lower.includes('leg') || lower.includes('hand') || lower.includes('foot') || lower.includes('face') || lower.includes('back') || lower.includes('neck') || lower.includes('chest') || lower.includes('stomach') || lower.includes('skin') || lower.includes('eye') || lower.includes('ear') || lower.includes('tooth') || lower.includes('teeth')) {
      if (!updatedState.body_location) updatedState.body_location = text;
    }
    if (lower.includes('fever') || lower.includes('warm') || lower.includes('hot') || lower.includes('chills')) {
      updatedState.fever = true;
    }
    if (lower.includes('worse') || lower.includes('spreading') || lower.includes('bigger') || lower.includes('increasing')) {
      updatedState.progression = 'worsening';
    } else if (lower.includes('better') || lower.includes('improving') || lower.includes('same')) {
      updatedState.progression = 'stable';
    }

    // 4. Conversation Flow State Machine
    const assistantTurns = conversationHistory.filter(m => m.sender === 'assistant').length;

    // Turn 1: Ask about location & progression
    if (!updatedState.body_location && assistantTurns <= 1) {
      return {
        nextMessage: {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: `I understand. Where on your body is the swelling or discomfort located, and is it staying in one spot or spreading?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedQuickReplies: ['On my arm', 'On my leg/foot', 'On my neck/face', 'On my torso'],
        },
        updatedState,
      };
    }

    // Turn 2: Ask about duration and fever
    if (!updatedState.duration && assistantTurns <= 2) {
      return {
        nextMessage: {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: `How long have you noticed these symptoms, and have you experienced any fever, chills, or dizziness?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedQuickReplies: ['Past 1-3 days, no fever', 'More than a week', 'Yes, mild fever', 'No other symptoms'],
        },
        updatedState,
      };
    }

    // Turn 3: Ask about severity and triggers if not clear
    if (!updatedState.severity && assistantTurns <= 3) {
      updatedState.severity = 'moderate';
      return {
        nextMessage: {
          id: `msg-${Date.now()}`,
          sender: 'assistant',
          text: `How would you describe the severity of the discomfort (mild, moderate, or severe), and does anything specific make it better or worse?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedQuickReplies: ['Mild discomfort', 'Moderate and bothersome', 'Severe and worsening', 'Hurts when touched'],
        },
        updatedState,
      };
    }

    // Turn 4: Finalize routing recommendation
    updatedState.conversation_complete = true;
    const routing = this.determineRouting(updatedState);
    updatedState.recommended_specialty = routing.specialty;
    updatedState.reason_for_routing = routing.reason_for_routing;

    const completionMsg: IntakeChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text: `Thank you for sharing those details. Based on your intake summary, we have structured your concern for doctor routing.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRoutingCard: true,
    };

    return {
      nextMessage: completionMsg,
      updatedState,
      routingResult: routing,
    };
  }

  /**
   * Produces honest, non-diagnostic doctor routing based on intake evidence
   */
  public static determineRouting(state: MedicalIntakeState): StructuredRoutingResult {
    const combined = `${state.chief_complaint} ${state.body_location} ${state.possible_trigger} ${state.duration}`.toLowerCase();

    let specialty = 'General Physician';
    let reason = 'A general consultation is recommended to evaluate symptoms and coordinate care.';

    if (
      combined.includes('mosquito') ||
      combined.includes('bite') ||
      combined.includes('itching') ||
      combined.includes('rash') ||
      combined.includes('skin') ||
      combined.includes('acne') ||
      combined.includes('eczema')
    ) {
      specialty = 'Dermatologist';
      reason = 'Symptoms involve localized skin swelling, irritation, or an insect reaction, so a dermatology consultation is recommended for topical evaluation.';
    } else if (
      combined.includes('tooth') ||
      combined.includes('teeth') ||
      combined.includes('gum') ||
      combined.includes('jaw') ||
      combined.includes('dental')
    ) {
      specialty = 'Dentist';
      reason = 'Symptoms involve dental or oral discomfort, so a dental specialist consultation is indicated.';
    } else if (
      combined.includes('heart') ||
      combined.includes('palpitation') ||
      combined.includes('blood pressure') ||
      combined.includes('hypertension')
    ) {
      specialty = 'Cardiologist';
      reason = 'Symptoms pertain to cardiovascular health; specialist evaluation by a cardiologist is appropriate.';
    } else if (
      combined.includes('joint') ||
      combined.includes('knee') ||
      combined.includes('bone') ||
      combined.includes('fracture') ||
      combined.includes('sprain')
    ) {
      specialty = 'Orthopedic';
      reason = 'Concerns relate to joint, bone, or musculoskeletal discomfort; consultation with an orthopedic specialist is advised.';
    } else if (
      combined.includes('child') ||
      combined.includes('infant') ||
      combined.includes('baby') ||
      combined.includes('pediatric')
    ) {
      specialty = 'Pediatrician';
      reason = 'Patient is a child or infant; specialized pediatric care is recommended.';
    }

    return {
      request_type: 'symptom',
      chief_complaint: state.chief_complaint,
      specialty,
      location: state.location,
      query: state.chief_complaint,
      doctor_name: null,
      hospital_name: null,
      confidence: 0.9,
      needs_clarification: false,
      clarification_question: null,
      red_flags: state.red_flags,
      reason_for_routing: reason,
    };
  }
}
