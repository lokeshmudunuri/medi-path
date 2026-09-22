import type { OfflineAIProvider } from '../../types/ai';
import type { ModelManager } from '../../types/modelManager';
import { gemmaModelManager } from '../modelManager';
import { LocalOnDeviceModelProvider } from './LocalOnDeviceProvider';

/**
 * Gemma3LocalProvider
 * 
 * Target Model: google/gemma-3-1b-it (INT4 Quantized Mobile Model)
 * Artifact: gemma3-1b-it-int4.task (~528.97 MB)
 * Runtime Targets:
 * - Production Android: Google AI Edge / LiteRT MediaPipe GenAI LlmInference
 *   via native Android bridge (window.MediPathAndroidBridge)
 * - Development / Web Prototype: Local deterministic semantic intake engine
 * 
 * Non-Diagnostic Healthcare Intake & Triage Navigation Only.
 */
export class Gemma3LocalProvider implements OfflineAIProvider {
  public id = 'google/gemma-3-1b-it-int4';
  public name = 'Gemma 3 1B IT (INT4 Mobile / MediaPipe GenAI)';

  private modelManager: ModelManager;
  private fallbackProvider: LocalOnDeviceModelProvider;

  constructor(modelManager: ModelManager = gemmaModelManager) {
    this.modelManager = modelManager;
    this.fallbackProvider = new LocalOnDeviceModelProvider();
  }

  public getRuntimeMode(): 'ANDROID_ON_DEVICE' | 'DEV_MODE' | 'FALLBACK_ACTIVE' {
    if (typeof window !== 'undefined' && (window as any).MediPathAndroidBridge?.isLlmReady?.()) {
      return 'ANDROID_ON_DEVICE';
    }
    return 'DEV_MODE';
  }

  public async isAvailable(): Promise<boolean> {
    const isInstalled = await this.modelManager.isModelInstalled();
    return isInstalled;
  }

  public async initialize(): Promise<boolean> {
    const installed = await this.modelManager.isModelInstalled();
    if (!installed) {
      return false;
    }
    const loaded = await this.modelManager.loadModel();
    return loaded;
  }

  public async processText(userPrompt: string): Promise<string> {
    const installed = await this.modelManager.isModelInstalled();
    if (!installed) {
      throw new Error(
        'Gemma 3 1B IT INT4 model is not installed. Please download the mobile AI model to begin conversation.'
      );
    }

    // 1. Android Native On-Device Inference Path
    // If running inside Android WebView with native MediaPipe LLM Bridge
    if (typeof window !== 'undefined' && (window as any).MediPathAndroidBridge?.generateResponse) {
      try {
        const nativeResponse = await (window as any).MediPathAndroidBridge.generateResponse(userPrompt);
        if (nativeResponse) {
          return nativeResponse;
        }
      } catch (err) {
        console.warn('Native Android MediaPipe bridge error, using fallback:', err);
      }
    }

    // 2. Production Offline Rule: Do NOT depend on http://127.0.0.1:8008
    // Run entirely locally without network or external localhost server
    return this.fallbackProvider.processText(userPrompt);
  }

  public async generate(prompt: string): Promise<string> {
    return this.processText(prompt);
  }

  public async generateWithImage(prompt: string, _imageBase64OrUrl: string): Promise<string> {
    return this.processText(prompt);
  }
}

// Backwards compatibility alias
export const Gemma4E2BOnDeviceProvider = Gemma3LocalProvider;
