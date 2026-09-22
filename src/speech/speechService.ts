import type { SpeechToTextProvider, SpeechRecognitionError, SpeechRecognitionState, SupportedLanguageCode } from '../types/speech';
import { BrowserSpeechToTextProvider } from './providers/BrowserSpeechProvider';

/**
 * SpeechToTextService
 * 
 * Central manager for speech recognition.
 * Encapsulates provider instantiation, availability checks, and listener attachment.
 */
class SpeechToTextService {
  private activeProvider: SpeechToTextProvider;

  constructor(provider?: SpeechToTextProvider) {
    this.activeProvider = provider || new BrowserSpeechToTextProvider();
  }

  public setProvider(provider: SpeechToTextProvider) {
    this.activeProvider = provider;
  }

  public async isSupported(): Promise<boolean> {
    return await this.activeProvider.isAvailable();
  }

  public async startListening(languageCode?: SupportedLanguageCode): Promise<void> {
    await this.activeProvider.start(languageCode);
  }

  public setLanguage(languageCode: SupportedLanguageCode): void {
    if (this.activeProvider.setLanguage) {
      this.activeProvider.setLanguage(languageCode);
    }
  }

  public async stopListening(): Promise<void> {
    await this.activeProvider.stop();
  }

  public onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.activeProvider.onTranscript(callback);
  }

  public onError(callback: (error: SpeechRecognitionError) => void): void {
    this.activeProvider.onError(callback);
  }

  public onStateChange(callback: (state: SpeechRecognitionState) => void): void {
    if (this.activeProvider.onStateChange) {
      this.activeProvider.onStateChange(callback);
    }
  }
}

export const speechToTextService = new SpeechToTextService();
