import type { SpeechToTextProvider, SpeechRecognitionError, SpeechRecognitionState, SupportedLanguageCode } from '../../types/speech';

/**
 * NativeOnDeviceSpeechProvider
 * 
 * Production architecture target for on-device multilingual Whisper/Conformer
 * running locally on Android Snapdragon Hexagon NPU.
 * 
 * Boundary:
 * - Marked as native implementation required on Web/Vite environments.
 * - Bridges to Android JNI audio stream when packaged in Android APK.
 */
export class NativeOnDeviceSpeechProvider implements SpeechToTextProvider {
  public id = 'native-on-device-snapdragon-stt';
  public name = 'Snapdragon On-Device Speech (Hexagon NPU)';

  private isAvailableOnDevice = false;

  public async isAvailable(): Promise<boolean> {
    return this.isAvailableOnDevice;
  }

  public async start(_languageCode?: SupportedLanguageCode): Promise<void> {
    throw new Error('Native Snapdragon NPU Speech requires Android runtime environment.');
  }

  public async stop(): Promise<void> {
    // Android NDK audio stop
  }

  public onTranscript(_callback: (text: string, isFinal: boolean) => void): void {}
  public onError(_callback: (error: SpeechRecognitionError) => void): void {}
  public onStateChange?(_callback: (state: SpeechRecognitionState) => void): void {}
}
