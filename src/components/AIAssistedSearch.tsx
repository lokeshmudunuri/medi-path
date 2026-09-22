import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Cpu, 
  ArrowRight, 
  RefreshCw, 
  CheckCircle2, 
  Mic, 
  Square,
  Download,
  Trash2,
  HardDrive,
  Check,
  Send,
  Globe,
  User,
  Bot,
  AlertTriangle
} from 'lucide-react';
import { gemmaModelManager } from '../ai/modelManager';
import { speechToTextService } from '../speech/speechService';
import { useLocation } from '../context/LocationContext';
import { discoverDoctorsFromAI } from '../services/aiSearchAdapter';
import { ConversationalIntakeEngine } from '../ai/ConversationalIntakeEngine';
import { SUPPORTED_INDIAN_LANGUAGES } from '../types/speech';
import type { SupportedLanguageCode, SpeechRecognitionState } from '../types/speech';
import type { ModelDownloadProgress } from '../types/modelManager';
import type { MedicalIntakeState, IntakeChatMessage, StructuredRoutingResult } from '../types/intake';

export const AIAssistedSearch: React.FC = () => {
  const { selectedLocation } = useLocation();
  const navigate = useNavigate();

  // Model Manager (Truthful State: Not Installed -> Download -> Installed)
  const [modelProgress, setModelProgress] = useState<ModelDownloadProgress>({
    status: gemmaModelManager.getModelStatus(),
    bytesDownloaded: 0,
    totalBytes: gemmaModelManager.getModelSize(),
    percentage: 0,
  });

  // Speech Recognition States
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguageCode>('en-IN');
  const [speechState, setSpeechState] = useState<SpeechRecognitionState>('idle');
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Input & Messaging States
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Conversation State
  const [intakeState, setIntakeState] = useState<MedicalIntakeState>(() => 
    ConversationalIntakeEngine.createInitialState(selectedLocation.name)
  );

  const [chatMessages, setChatMessages] = useState<IntakeChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      text: 'Hello, I am your MediPath Intake Assistant. Please describe what health concern or symptoms you are experiencing in your own words. We will ask a few follow-up questions to understand the context and guide you to an appropriate doctor.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedQuickReplies: [
        'Persistent skin rash or itch',
        'Tooth ache or gum swelling',
        'Heart palpitations or chest pressure',
        'Knee and joint stiffness'
      ]
    }
  ]);

  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [routingResult, setRoutingResult] = useState<StructuredRoutingResult | null>(null);
  const [matchingDoctorsCount, setMatchingDoctorsCount] = useState<number | null>(null);

  // Subscribe to ModelManager updates
  useEffect(() => {
    const unsubscribe = gemmaModelManager.onProgress((progress) => {
      setModelProgress(progress);
    });
    return () => unsubscribe();
  }, []);

  // Initialize Speech-to-Text hooks
  useEffect(() => {

    speechToTextService.onStateChange((state) => {
      setSpeechState(state);
      if (state === 'listening') {
        const langObj = SUPPORTED_INDIAN_LANGUAGES.find(l => l.code === selectedLanguage);
        setVoiceNotice(`Listening continuously in ${langObj?.name || 'English'}... Speak naturally without rushing.`);
      } else if (state === 'idle') {
        setVoiceNotice(null);
      }
    });

    speechToTextService.onTranscript((accumulatedText, isFinal) => {
      setInputText(accumulatedText);
      if (isFinal) {
        setVoiceNotice('Voice captured! You can review or edit in the box below before sending.');
      }
    });

    speechToTextService.onError((err) => {
      setSpeechState('idle');
      setVoiceNotice(err.message);
    });

    return () => {
      speechToTextService.stopListening();
    };
  }, [selectedLanguage]);

  // Scroll chat messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isProcessingTurn]);

  // Handle Language Change
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value as SupportedLanguageCode;
    setSelectedLanguage(newLang);
    speechToTextService.setLanguage(newLang);
  };

  // Toggle Continuous Microphone Session
  const handleToggleVoice = async () => {
    if (speechState === 'listening') {
      await speechToTextService.stopListening();
    } else {
      setVoiceNotice('Connecting to microphone...');
      await speechToTextService.startListening(selectedLanguage);
    }
  };


  // User submits a turn (text or quick reply)
  const handleSendTurn = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent) return;

    if (speechState === 'listening') {
      await speechToTextService.stopListening();
    }

    // Add user message to chat
    const userMsg: IntakeChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: messageContent,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsProcessingTurn(true);

    // Simulate conversational intake deliberation (or native model reasoning)
    setTimeout(() => {
      const { nextMessage, updatedState, routingResult: routing } = ConversationalIntakeEngine.processTurn(
        messageContent,
        intakeState,
        [...chatMessages, userMsg]
      );

      setIntakeState(updatedState);
      setChatMessages((prev) => [...prev, nextMessage]);
      setIsProcessingTurn(false);

      if (routing) {
        setRoutingResult(routing);
        const docs = discoverDoctorsFromAI({
          request_type: routing.request_type,
          query: routing.query,
          specialty: routing.specialty,
          location: routing.location || selectedLocation.name,
          doctor_name: routing.doctor_name,
          hospital_name: routing.hospital_name,
          confidence: routing.confidence,
          needs_clarification: routing.needs_clarification,
          clarification_question: routing.clarification_question,
        }, selectedLocation.name);
        setMatchingDoctorsCount(docs.length);
      }
    }, 600);
  };

  // Navigate to existing Doctor search with structured routing params
  const handleViewDoctors = () => {
    if (!routingResult) return;
    const params = new URLSearchParams();
    const loc = routingResult.location || selectedLocation.name;
    if (loc) params.set('location', loc);
    if (routingResult.specialty) params.set('specialty', routingResult.specialty);
    if (routingResult.chief_complaint) params.set('query', routingResult.chief_complaint);
    navigate(`/doctors?${params.toString()}`);
  };

  // Reset conversation to initial state
  const handleResetConversation = () => {
    setIntakeState(ConversationalIntakeEngine.createInitialState(selectedLocation.name));
    setRoutingResult(null);
    setMatchingDoctorsCount(null);
    setInputText('');
    setChatMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: 'Hello, I am your MediPath Intake Assistant. Please describe what health concern or symptoms you are experiencing.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedQuickReplies: [
          'Persistent skin rash or itch',
          'Tooth ache or gum swelling',
          'Heart palpitations or chest pressure',
          'Knee and joint stiffness'
        ]
      }
    ]);
  };

  const isModelReady = modelProgress.status === 'ready';

  return (
    <section className="ai-search-container" id="ai-assisted-search-section">
      <div className="container">
        <div className="ai-search-card">
          
          {/* Header */}
          <div className="ai-search-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <div className="ai-badge">
                  <Cpu size={15} />
                  <span>On-Device AI Assistant</span>
                </div>
                <div className="voice-badge">
                  <Globe size={13} />
                  <span>Multilingual Intake</span>
                </div>
              </div>

              {/* Language Selector */}
              <div className="language-selector-wrap" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <label htmlFor="ai-language-select" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--gray-600)' }}>
                  Language:
                </label>
                <select
                  id="ai-language-select"
                  className="sort-select"
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.82rem' }}
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                >
                  {SUPPORTED_INDIAN_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.nativeName} ({lang.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <h2 className="ai-search-title">Conversational Medical Intake & Doctor Routing</h2>
            <p className="ai-search-subtitle">
              Speak or describe your symptoms naturally. The assistant asks context-dependent follow-up questions 
              to route you to the right specialist without making clinical diagnoses. Raw medical descriptions remain on-device.
            </p>
          </div>

          {/* Model Management Layer (Truthful Status) */}
          <div className="model-manager-card" id="gemma-model-manager-card">
            <div className="model-manager-header">
              <div className="model-info-block">
                <div className="model-icon-wrap">
                  <HardDrive size={22} />
                </div>
                <div>
                  <div className="model-title-text">
                    MediPath AI • On-Device Model
                    {isModelReady ? (
                      <span className="model-ready-banner">
                        <Check size={14} /> MediPath AI Ready
                      </span>
                    ) : (
                      <span className="model-fallback-badge">
                        Model Not Installed
                      </span>
                    )}
                  </div>
                  <p className="model-desc-text">
                    {isModelReady
                      ? 'Gemma 3 1B IT (INT4 Mobile) is ready. Inference runs 100% locally on your device without cloud LLMs or remote inference servers.'
                      : 'Your private AI assistant runs locally on your device. The Gemma 3 1B IT INT4 mobile model (MediaPipe GenAI) is required before you can start conversational medical intake.'}
                  </p>
                  <div className="model-specs-row">
                    <span className="model-spec-pill">Model: Gemma 3 1B IT INT4 (Google AI Edge)</span>
                    <span className="model-spec-pill">Artifact Size: 528.97 MB (.task bundle)</span>
                    <span className="model-spec-pill">Runtime: Android MediaPipe GenAI / LiteRT</span>
                    <span className="model-spec-pill">Memory Target: 4 GB min / 6 GB+ pref</span>
                  </div>
                </div>
              </div>

              <div className="model-action-wrap">
                {modelProgress.status === 'not-installed' && (
                  <button
                    type="button"
                    className="btn-download-model"
                    id="btn-download-ai-model"
                    onClick={() => gemmaModelManager.downloadModel()}
                  >
                    <Download size={16} />
                    Download MediPath AI
                  </button>
                )}

                {modelProgress.status === 'downloading' && (
                  <button type="button" className="btn-download-model" disabled>
                    <RefreshCw size={16} className="spinning" />
                    Downloading MediPath AI ({modelProgress.percentage}%)...
                  </button>
                )}

                {modelProgress.status === 'verifying' && (
                  <button type="button" className="btn-download-model" disabled>
                    <RefreshCw size={16} className="spinning" />
                    Verifying Model...
                  </button>
                )}

                {isModelReady && (
                  <button
                    type="button"
                    className="btn-delete-model"
                    title="Reset model status"
                    onClick={() => gemmaModelManager.deleteModel()}
                  >
                    <Trash2 size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Reset Model
                  </button>
                )}
              </div>
            </div>

            {/* Download Progress Bar */}
            {modelProgress.status === 'downloading' && (
              <div className="model-progress-container" id="model-download-progress-container">
                <div className="model-progress-meta">
                  <span>Downloading gemma3-1b-it-int4.task (MediaPipe GenAI)...</span>
                  <span>{modelProgress.percentage}% ({((modelProgress.bytesDownloaded / (1024 * 1024))).toFixed(1)} MB / 528.97 MB)</span>
                </div>
                <div className="model-progress-bar-bg">
                  <div
                    className="model-progress-bar-fill"
                    style={{ width: `${modelProgress.percentage}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>

          {/* Model Gate: If not installed, show clean install prompt */}
          {!isModelReady ? (
            <div style={{
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: '0.75rem',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              marginTop: '1rem'
            }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#eff6ff',
                color: 'var(--primary)',
                marginBottom: '1rem'
              }}>
                <HardDrive size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
                MediPath AI — On-Device Model Required
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.92rem', maxWidth: '480px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
                Your private assistant runs locally on-device. The Gemma 3 1B IT INT4 mobile model (~528 MB) is required before you can start conversational intake.
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => gemmaModelManager.downloadModel()}
                disabled={modelProgress.status === 'downloading' || modelProgress.status === 'verifying'}
                style={{ padding: '0.75rem 1.8rem', fontSize: '0.95rem' }}
              >
                {modelProgress.status === 'downloading' ? `Downloading (${modelProgress.percentage}%)...` : 'Download MediPath AI (Gemma 3 1B IT INT4)'}
              </button>
            </div>
          ) : (

          /* Conversational Intake Chat Thread */
          <div className="intake-chat-window" id="intake-chat-window">
            <div className="intake-chat-messages">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`intake-message-row ${msg.sender}`}>
                  <div className="intake-avatar">
                    {msg.sender === 'assistant' ? <Bot size={18} /> : <User size={18} />}
                  </div>
                  <div className={`intake-bubble ${msg.isRedFlagWarning ? 'red-flag-bubble' : ''}`}>
                    <div className="intake-bubble-content">
                      {msg.text}
                    </div>


                    {/* Routing Card rendered inline when intake completes */}
                    {msg.isRoutingCard && routingResult && (
                      <div className="intake-routing-card">
                        <div className="routing-card-header">
                          <CheckCircle2 size={18} color="var(--success)" />
                          <h4>Structured Routing Recommendation</h4>
                        </div>
                        <div className="routing-card-body">
                          <div className="routing-spec-row">
                            <span className="spec-label">Recommended Specialty:</span>
                            <span className="spec-val highlight">{routingResult.specialty}</span>
                          </div>
                          <div className="routing-spec-row">
                            <span className="spec-label">Reason for Routing:</span>
                            <span className="spec-reason-text">{routingResult.reason_for_routing}</span>
                          </div>
                          {routingResult.red_flags.length > 0 && (
                            <div className="routing-red-flags">
                              <AlertTriangle size={15} color="#dc2626" />
                              <span>Urgent Symptoms Flagged: {routingResult.red_flags.join(', ')}</span>
                            </div>
                          )}
                        </div>
                        <div className="routing-card-actions">
                          <button
                            type="button"
                            className="btn-primary"
                            id="view-matching-doctors-btn"
                            onClick={handleViewDoctors}
                          >
                            <span>View {matchingDoctorsCount ?? ''} Matching Doctors</span>
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Suggested Quick Replies */}
                    {msg.suggestedQuickReplies && !routingResult && (
                      <div className="intake-quick-replies">
                        {msg.suggestedQuickReplies.map((reply, rIdx) => (
                          <button
                            key={rIdx}
                            type="button"
                            className="quick-reply-pill"
                            onClick={() => handleSendTurn(reply)}
                          >
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="intake-time">{msg.timestamp}</div>
                  </div>
                </div>
              ))}

              {isProcessingTurn && (
                <div className="intake-message-row assistant">
                  <div className="intake-avatar"><Bot size={18} /></div>
                  <div className="intake-bubble typing-bubble">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Voice Notice Indicator */}
            {voiceNotice && (
              <div className="voice-notice-banner" id="voice-notice-banner">
                <Mic size={14} className={speechState === 'listening' ? 'pulse-icon' : ''} />
                <span>{voiceNotice}</span>
              </div>
            )}

            {/* Input Bar (Text + Microphone) */}
            <div className="intake-input-area">
              <button
                type="button"
                id="mic-session-btn"
                className={`intake-icon-btn ${speechState === 'listening' ? 'mic-active' : ''}`}
                title={speechState === 'listening' ? 'Stop Listening' : 'Continuous Voice Recognition'}
                onClick={handleToggleVoice}
              >
                {speechState === 'listening' ? <Square size={18} fill="#ffffff" /> : <Mic size={20} />}
              </button>

              <textarea
                ref={textareaRef}
                id="intake-text-input"
                className="intake-input-field"
                placeholder={
                  speechState === 'listening'
                    ? `Listening in ${SUPPORTED_INDIAN_LANGUAGES.find(l => l.code === selectedLanguage)?.name}... Speak continuously.`
                    : 'Describe your symptoms or answer the assistant (e.g. "I have stomach pain since yesterday")...'
                }
                rows={2}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendTurn();
                  }
                }}
              />

              <button
                type="button"
                id="intake-send-btn"
                className="intake-send-btn"
                title="Send message"
                disabled={!inputText.trim() || isProcessingTurn}
                onClick={() => handleSendTurn()}
              >
                <Send size={18} />
              </button>
            </div>

            {/* Footer reset button */}
            <div className="intake-window-footer">
              <span className="privacy-pill-text">🔒 Privacy Guard: Free-form text and images remain on-device</span>
              <button type="button" className="btn-reset-conversation" onClick={handleResetConversation}>
                Start New Intake
              </button>
            </div>

          </div>
          )}

        </div>
      </div>
    </section>
  );
};
