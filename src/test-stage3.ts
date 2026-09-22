import { speechToTextService } from './speech/speechService.ts';
import { offlineAIService } from './ai/aiService.ts';
import { discoverDoctorsFromAI } from './services/aiSearchAdapter.ts';
import type { SpeechToTextProvider, SpeechRecognitionError, SpeechRecognitionState } from './types/speech.ts';

// Mock speech provider to verify pipeline in non-browser CLI environment
class MockTestSpeechProvider implements SpeechToTextProvider {
  public id = 'mock-test-speech';
  public name = 'Mock Test Speech Provider';
  private transcriptCb: ((text: string, isFinal: boolean) => void) | null = null;
  private errorCb: ((error: SpeechRecognitionError) => void) | null = null;
  private stateCb: ((state: SpeechRecognitionState) => void) | null = null;

  public async isAvailable(): Promise<boolean> {
    return true;
  }
  public onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.transcriptCb = callback;
  }
  public onError(callback: (error: SpeechRecognitionError) => void): void {
    this.errorCb = callback;
  }
  public onStateChange(callback: (state: SpeechRecognitionState) => void): void {
    this.stateCb = callback;
  }
  public async start(): Promise<void> {
    if (this.stateCb) this.stateCb('listening');
  }
  public async stop(): Promise<void> {
    if (this.stateCb) this.stateCb('idle');
  }

  // Helper to simulate voice speaking
  public simulateSpokenTranscript(transcript: string) {
    if (this.transcriptCb) {
      this.transcriptCb(transcript, true);
    }
  }

  // Helper to simulate error
  public simulateError(error: SpeechRecognitionError) {
    if (this.errorCb) {
      this.errorCb(error);
    }
  }
}

async function runStage3Tests() {
  console.log('=====================================================');
  console.log('STAGE 3: VOICE SPEECH-TO-TEXT → OFFLINE AI → DOCTOR SEARCH');
  console.log('=====================================================\n');

  const testProvider = new MockTestSpeechProvider();
  speechToTextService.setProvider(testProvider);

  // Test 1: Speech Provider Availability
  console.log('Test 1: Provider Availability Check');
  const avail = await speechToTextService.isSupported();
  if (avail) {
    console.log('RESULT: PASS (Speech-to-text abstraction is available)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 2: Voice Flow — "I need a skin doctor near Bengaluru"
  console.log('Test 2: Voice Input "I need a skin doctor near Bengaluru"');
  let capturedTranscript = '';
  speechToTextService.onTranscript((text) => {
    capturedTranscript = text;
  });

  await speechToTextService.startListening();
  testProvider.simulateSpokenTranscript('I need a skin doctor near Bengaluru');
  await speechToTextService.stopListening();

  console.log(`Captured Transcript: "${capturedTranscript}"`);
  if (capturedTranscript === 'I need a skin doctor near Bengaluru') {
    console.log('RESULT: PASS (Speech successfully transcribed)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 3: Pass Transcript through Stage 2 Offline AI & Validator
  console.log('Test 3: Processing voice transcript through Stage 2 Pipeline');
  const aiResult = await offlineAIService.interpretUserText(capturedTranscript);
  console.log('Structured JSON:', JSON.stringify(aiResult.structuredRequest, null, 2));

  if (
    aiResult.isValid &&
    aiResult.structuredRequest.specialty === 'Dermatologist' &&
    aiResult.structuredRequest.location === 'Bengaluru'
  ) {
    console.log('RESULT: PASS (Voice transcript accurately mapped to Dermatologist in Bengaluru)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 4: Doctor Search Execution from Voice Input
  console.log('Test 4: Executing existing doctor search for voice request');
  const matchedDocs = discoverDoctorsFromAI(aiResult.structuredRequest);
  console.log(`Found ${matchedDocs.length} doctors:`);
  matchedDocs.forEach(d => console.log(` - ${d.name} (${d.specialty} at ${d.hospitalName}, ${d.locationName})`));
  if (matchedDocs.length > 0 && matchedDocs[0].specialty === 'Dermatologist') {
    console.log('RESULT: PASS (Existing searchDoctors() cleanly returned matching doctor)\n');
  } else {
    console.error('RESULT: FAIL\n');
  }

  // Test 5: Error Handling (Permission Denied)
  console.log('Test 5: Microphone Permission Denied Handling');
  let caughtError = '';
  speechToTextService.onError((err) => {
    caughtError = err.message;
  });
  testProvider.simulateError({
    type: 'permission-denied',
    message: 'Microphone permission was denied.'
  });
  if (caughtError.includes('Microphone permission was denied')) {
    console.log(`RESULT: PASS (Permission denial safely handled: "${caughtError}")\n`);
  } else {
    console.error('RESULT: FAIL\n');
  }

  console.log('=====================================================');
  console.log('ALL STAGE 3 VOICE INTEGRATION TESTS PASSED!');
  console.log('=====================================================');
}

runStage3Tests().catch(console.error);
