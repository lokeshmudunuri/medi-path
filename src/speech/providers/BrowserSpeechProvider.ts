import type { SpeechToTextProvider, SpeechRecognitionError, SpeechRecognitionState, SupportedLanguageCode } from '../../types/speech';
import { SUPPORTED_INDIAN_LANGUAGES } from '../../types/speech';

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

/**
 * ContinuousBrowserSpeechProvider
 * 
 * Implements continuous, multilingual speech session capture without premature cutoffs.
 * Accumulates recognized segments properly rather than overwriting.
 * Supports automatic restart on pause and language switching.
 */
export class BrowserSpeechToTextProvider implements SpeechToTextProvider {
  public id = 'browser-web-speech';
  public name = 'Browser Web Speech (Continuous Multilingual Fallback)';

  private recognition: any = null;
  private transcriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private errorCallback: ((error: SpeechRecognitionError) => void) | null = null;
  private stateCallback: ((state: SpeechRecognitionState) => void) | null = null;
  
  private isExplicitlyListening = false;
  private selectedLanguage: SupportedLanguageCode = 'en-IN';
  private accumulatedTranscript = '';
  private currentInterim = '';

  constructor() {
    this.initRecognition();
  }

  private initRecognition() {
    const win = typeof window !== 'undefined' ? (window as unknown as IWindow) : null;
    const SpeechRecognitionClass = win?.SpeechRecognition || win?.webkitSpeechRecognition;

    if (SpeechRecognitionClass) {
      this.recognition = new SpeechRecognitionClass();
      // Continuous = true ensures the engine does not stop after a single short phrase
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.setLangTag();
      this.setupEventHandlers();
    }
  }

  private setLangTag() {
    if (!this.recognition) return;
    const match = SUPPORTED_INDIAN_LANGUAGES.find(l => l.code === this.selectedLanguage);
    this.recognition.lang = match?.speechEngineTag || 'en-IN';
  }

  public setLanguage(languageCode: SupportedLanguageCode) {
    this.selectedLanguage = languageCode;
    this.setLangTag();
  }

  public async isAvailable(): Promise<boolean> {
    return this.recognition !== null;
  }

  public onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.transcriptCallback = callback;
  }

  public onError(callback: (error: SpeechRecognitionError) => void): void {
    this.errorCallback = callback;
  }

  public onStateChange(callback: (state: SpeechRecognitionState) => void): void {
    this.stateCallback = callback;
  }

  private setState(state: SpeechRecognitionState) {
    if (this.stateCallback) {
      this.stateCallback(state);
    }
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.setState('listening');
    };

    this.recognition.onresult = (event: any) => {
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          // Accumulate final transcript segments cleanly
          if (this.accumulatedTranscript && !this.accumulatedTranscript.endsWith(' ')) {
            this.accumulatedTranscript += ' ';
          }
          this.accumulatedTranscript += text.trim();
        } else {
          interim += text;
        }
      }

      this.currentInterim = interim.trim();

      const combined = this.currentInterim 
        ? `${this.accumulatedTranscript} ${this.currentInterim}`.trim()
        : this.accumulatedTranscript;

      if (this.transcriptCallback) {
        this.transcriptCallback(combined, !this.currentInterim);
      }
    };

    this.recognition.onerror = (event: any) => {
      // Ignore routine 'no-speech' events when listening continuously
      if (event.error === 'no-speech' && this.isExplicitlyListening) {
        return;
      }

      let errorType: SpeechRecognitionError['type'] = 'unknown';
      let message = 'Speech recognition error';

      switch (event.error) {
        case 'not-allowed':
          errorType = 'permission-denied';
          message = 'Microphone permission denied. Please allow microphone access.';
          this.isExplicitlyListening = false;
          this.setState('error');
          break;
        case 'audio-capture':
          errorType = 'no-microphone';
          message = 'No microphone detected.';
          this.isExplicitlyListening = false;
          this.setState('error');
          break;
        case 'network':
          errorType = 'network';
          message = 'Network issue with speech engine.';
          break;
        case 'aborted':
          errorType = 'aborted';
          message = 'Speech listening aborted.';
          break;
        default:
          message = `Voice error: ${event.error}`;
      }

      if (this.errorCallback) {
        this.errorCallback({ type: errorType, message });
      }
    };

    this.recognition.onend = () => {
      // If user did not press stop, auto-restart continuous listening to prevent cutting off during pauses
      if (this.isExplicitlyListening) {
        try {
          this.recognition.start();
        } catch {
          this.isExplicitlyListening = false;
          this.setState('idle');
        }
      } else {
        this.setState('idle');
      }
    };
  }

  public async start(languageCode?: SupportedLanguageCode): Promise<void> {
    if (languageCode) {
      this.selectedLanguage = languageCode;
      this.setLangTag();
    }

    if (!this.recognition) {
      if (this.errorCallback) {
        this.errorCallback({
          type: 'unavailable',
          message: 'Speech recognition not supported in this browser. You can type directly.',
        });
      }
      return;
    }

    this.isExplicitlyListening = true;
    this.accumulatedTranscript = '';
    this.currentInterim = '';

    try {
      this.recognition.start();
    } catch {
      // Safe restart
    }
  }

  public async stop(): Promise<void> {
    this.isExplicitlyListening = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Safe ignore
      }
    }
    this.setState('idle');
  }
}
