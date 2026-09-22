/**
 * NativeAIProviderBridge
 * 
 * TypeScript bridge interface between the web frontend and the native Android Qualcomm GenieX runtime.
 * In a native Android WebView or Capacitor / React Native shell:
 * window.AndroidBridge exposes direct bindings to `com.medipath.ai.NativeAndroidBridge`.
 * 
 * In standard browser environments:
 * Truthfully reports unavailability and delegates safely to the local fallback provider.
 */

export interface NativeGemmaResponse {
  rawText: string;
  structuredJson?: any;
  executionTarget: 'NPU' | 'GPU' | 'CPU' | 'BROWSER_FALLBACK';
  latencyMs: number;
}

export class NativeAIProviderBridge {
  private static instance: NativeAIProviderBridge;

  public static getInstance(): NativeAIProviderBridge {
    if (!this.instance) {
      this.instance = new NativeAIProviderBridge();
    }
    return this.instance;
  }

  /**
   * Checks if running inside native Android shell with Qualcomm GenieX support
   */
  public hasNativeBridge(): boolean {
    return typeof window !== 'undefined' && !!(window as any).AndroidBridge;
  }

  /**
   * Check if Gemma 4 E2B-it is installed on device storage
   */
  public async isModelInstalled(): Promise<boolean> {
    if (this.hasNativeBridge()) {
      try {
        return (window as any).AndroidBridge.isModelInstalled();
      } catch (err) {
        console.error('Error invoking native AndroidBridge:', err);
        return false;
      }
    }
    return false;
  }

  /**
   * Trigger native download in Android background service
   */
  public async downloadModel(): Promise<void> {
    if (this.hasNativeBridge()) {
      return (window as any).AndroidBridge.downloadModel();
    }
    throw new Error('Native Qualcomm GenieX bridge is only available in the Android application.');
  }

  /**
   * Load model into Hexagon NPU / Adreno GPU memory
   */
  public async loadModel(): Promise<boolean> {
    if (this.hasNativeBridge()) {
      return (window as any).AndroidBridge.loadModel();
    }
    return false;
  }

  /**
   * Run on-device inference turn
   */
  public async runInference(prompt: string, language: string): Promise<NativeGemmaResponse> {
    if (this.hasNativeBridge()) {
      const responseStr = await (window as any).AndroidBridge.runInference(prompt, language);
      return JSON.parse(responseStr);
    }
    throw new Error('Native Qualcomm execution unavailable in browser environment.');
  }
}
