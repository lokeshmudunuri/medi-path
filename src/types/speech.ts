/**
 * Speech Recognition Types and Multilingual Session Interfaces
 * 
 * Complies with the 10 major Indian official languages + English:
 * 1. Hindi
 * 2. Bengali
 * 3. Marathi
 * 4. Telugu
 * 5. Tamil
 * 6. Gujarati
 * 7. Urdu
 * 8. Kannada
 * 9. Odia
 * 10. Malayalam
 * + English
 */

export type SpeechRecognitionState = 'idle' | 'listening' | 'processing' | 'paused' | 'stopped' | 'error';

export interface SpeechRecognitionError {
  type: 'permission-denied' | 'no-microphone' | 'unavailable' | 'no-speech' | 'network' | 'aborted' | 'unknown';
  message: string;
}

export type SupportedLanguageCode = 
  | 'auto'
  | 'en-IN'
  | 'hi-IN'
  | 'bn-IN'
  | 'mr-IN'
  | 'te-IN'
  | 'ta-IN'
  | 'gu-IN'
  | 'ur-IN'
  | 'kn-IN'
  | 'or-IN'
  | 'ml-IN';

export interface SupportedLanguage {
  code: SupportedLanguageCode;
  name: string;
  nativeName: string;
  speechEngineTag: string;
}

export const SUPPORTED_INDIAN_LANGUAGES: SupportedLanguage[] = [
  { code: 'auto', name: 'Auto Detect', nativeName: 'Auto', speechEngineTag: 'en-IN' },
  { code: 'en-IN', name: 'English (India)', nativeName: 'English', speechEngineTag: 'en-IN' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', speechEngineTag: 'hi-IN' },
  { code: 'bn-IN', name: 'Bengali', nativeName: 'বাংলা', speechEngineTag: 'bn-IN' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', speechEngineTag: 'mr-IN' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', speechEngineTag: 'te-IN' },
  { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்', speechEngineTag: 'ta-IN' },
  { code: 'gu-IN', name: 'Gujarati', nativeName: 'ગુજરાતી', speechEngineTag: 'gu-IN' },
  { code: 'ur-IN', name: 'Urdu', nativeName: 'اردو', speechEngineTag: 'ur-IN' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speechEngineTag: 'kn-IN' },
  { code: 'or-IN', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speechEngineTag: 'or-IN' },
  { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം', speechEngineTag: 'ml-IN' },
];

export interface SpeechSession {
  sessionId: string;
  state: SpeechRecognitionState;
  language: SupportedLanguageCode;
  accumulatedTranscript: string;
  interimTranscript: string;
}

export interface SpeechToTextProvider {
  id: string;
  name: string;
  isAvailable(): Promise<boolean>;
  start(languageCode?: SupportedLanguageCode): Promise<void>;
  stop(): Promise<void>;
  setLanguage?(languageCode: SupportedLanguageCode): void;
  onTranscript(callback: (text: string, isFinal: boolean) => void): void;
  onError(callback: (error: SpeechRecognitionError) => void): void;
  onStateChange?(callback: (state: SpeechRecognitionState) => void): void;
}
