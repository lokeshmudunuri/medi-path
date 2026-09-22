import type { OfflineAIProvider, AIInterpretationResult } from '../types/ai';
import { LocalOnDeviceModelProvider } from './providers/LocalOnDeviceProvider';
import { Gemma3LocalProvider, Gemma4E2BOnDeviceProvider } from './providers/Gemma3LocalProvider';
import { parseAndValidateAIResponse } from './validator';

export { LocalOnDeviceModelProvider, Gemma3LocalProvider, Gemma4E2BOnDeviceProvider };

/**
 * OfflineAIService
 * 
 * Orchestrates the offline text interpretation flow:
 * Text Input -> Offline AI Provider (Gemma 4 E2B-it / Local Fallback) -> Raw JSON -> Parser & Schema Validator -> Normalized Structured Request
 */
class OfflineAIService {
  private activeProvider: OfflineAIProvider;

  constructor(provider?: OfflineAIProvider) {
    // Default to Gemma4E2BOnDeviceProvider (which seamlessly delegates to local semantic provider in web prototype)
    this.activeProvider = provider || new Gemma4E2BOnDeviceProvider();
  }

  /**
   * Set a different local model provider (e.g. LocalOnDeviceModelProvider or custom native provider)
   */
  public setProvider(provider: OfflineAIProvider) {
    this.activeProvider = provider;
  }

  public getActiveProviderName(): string {
    return this.activeProvider.name;
  }

  public async checkAvailability(): Promise<boolean> {
    try {
      return await this.activeProvider.isAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Interprets natural-language text completely offline into a validated StructuredAIRequest.
   */
  public async interpretUserText(text: string): Promise<AIInterpretationResult> {
    const isAvail = await this.checkAvailability();
    if (!isAvail) {
      return {
        isValid: false,
        validationErrors: ['Offline AI provider is currently unavailable.'],
        structuredRequest: {
          request_type: 'symptom',
          query: text,
          specialty: null,
          location: null,
          doctor_name: null,
          hospital_name: null,
          confidence: 0,
          needs_clarification: false,
        },
      };
    }

    try {
      // 1. Process with the offline provider
      const rawResponse = await this.activeProvider.processText(text);

      // 2. Validate and parse through the strict validation layer
      const validation = parseAndValidateAIResponse(rawResponse);

      if (!validation.isValid || !validation.data) {
        return {
          rawResponse,
          isValid: false,
          validationErrors: validation.errors,
          structuredRequest: {
            request_type: 'symptom',
            query: text,
            specialty: null,
            location: null,
            doctor_name: null,
            hospital_name: null,
            confidence: 0,
            needs_clarification: false,
          },
        };
      }

      return {
        rawResponse,
        isValid: true,
        structuredRequest: validation.data,
      };
    } catch (err: any) {
      return {
        isValid: false,
        validationErrors: [err?.message || 'Unexpected error in offline AI engine.'],
        structuredRequest: {
          request_type: 'symptom',
          query: text,
          specialty: null,
          location: null,
          doctor_name: null,
          hospital_name: null,
          confidence: 0,
          needs_clarification: false,
        },
      };
    }
  }
}

export const offlineAIService = new OfflineAIService();
