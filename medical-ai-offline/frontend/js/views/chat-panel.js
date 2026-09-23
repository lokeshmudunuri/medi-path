import { api } from '../api.js';
import { esc, toast } from '../components/ui.js';

let modelLabel = 'Gemma 3 1B';
let explanationMode = 'sample';
let isTargetModel = false;

const SUGGESTED_QUESTIONS = [
  'What are these medicines for?',
  'Summarize this prescription.',
  'What should I review with my doctor?',
  'Explain this report simply.',
  'What information is uncertain?',
];

export async function renderChatPanel(host, caseId, caseData = null) {
  await loadModelLabel();

  host.innerHTML = `
    <div class="card">
      <div class="spread mb-8">
        <div>
          <p class="card-title" style="margin:0">Ask About This Case</p>
          <p class="tiny muted mt-8">Answers are strictly based on your stored case data and approved local medical information. This application is not a doctor and never invents medical facts.</p>
        </div>
        <div class="row" id="model-badge"></div>
      </div>

      <div class="prompt-chips" id="prompt-chips">
        ${SUGGESTED_QUESTIONS.map((q) => `<button class="prompt-chip" data-q="${esc(q)}">${esc(q)}</button>`).join('')}
      </div>

      <div class="chat-panel">
        <div class="chat-log" id="chat-log"></div>
        <div class="chat-input">
          <textarea id="chat-text" rows="1" placeholder="Ask questions about this case…" autocomplete="off"></textarea>
          <button class="icon-btn" id="mic" title="Voice input" aria-label="Voice input">🎤</button>
          <button class="icon-btn" id="send" title="Send" aria-label="Send">➤</button>
        </div>
      </div>
    </div>
  `;

  const log = document.getElementById('chat-log');
  const input = document.getElementById('chat-text');
  const sendBtn = document.getElementById('send');
  const micBtn = document.getElementById('mic');
  const chips = document.getElementById('prompt-chips');

  chips.querySelectorAll('.prompt-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.q;
      send();
    });
  });

  let mediaRec = null;
  let chunks = [];

  function rebuildHeader() {
    const badge = document.getElementById('model-badge');
    if (!badge) return;
    const pillCls = explanationMode === 'connected' ? 'ok' : 'warn';
    const pillLabel = explanationMode === 'connected'
      ? (isTargetModel ? `Local AI • Gemma 3 1B • On-device` : `Local AI • ${modelLabel}`)
      : `AI • Offline Sample Mode`;
    badge.innerHTML = `<span class="pill ${pillCls}" title="The local model generating grounded responses">▲ ${esc(pillLabel)}</span>`;
  }

  async function loadModelLabel() {
    try {
      const s = await fetch('/api/llm/status').then((r) => r.json());
      explanationMode = s.connected && s.provider === 'ollama' ? 'connected' : 'sample';
      modelLabel = s.connected ? (s.active_model || s.model_name) : 'Gemma 3 1B';
      isTargetModel = Boolean(s.is_target_model);
    } catch {
      explanationMode = 'sample';
    }
  }

  function scrollToBottom() { log.scrollTop = log.scrollHeight; }

  function messageHtml(m) {
    const isUser = m.role === 'user';
    const who = isUser ? 'You' : (explanationMode === 'connected' ? `Local AI (${esc(modelLabel)})` : 'Local AI (Offline Sample)');
    return `
      <div class="bubble ${esc(m.role)}">
        <span class="who">${esc(who)}</span>
        ${esc(m.content)}
        ${m.media_path ? `<audio class="audio-player" controls src="/api/cases/${esc(caseId)}/chat/audio/${esc(m.id)}"></audio>` : ''}
      </div>`;
  }

  async function loadHistory() {
    try {
      const { messages } = await api.get(`/api/cases/${caseId}/chat`);
      if (!messages.length) {
        log.innerHTML = `
          <div class="bubble system">
            Case loaded into grounded local memory. Ask questions using the suggestions above or type below.
          </div>`;
      } else {
        log.innerHTML = messages.map(messageHtml).join('');
      }
      scrollToBottom();
    } catch (e) {
      log.innerHTML = `<div class="bubble system">${esc(e.message)}</div>`;
    }
  }

  function appendLocal(role, content) {
    log.insertAdjacentHTML('beforeend', `<div class="bubble ${role}"><span class="who">${role === 'user' ? 'You' : 'Local AI'}</span>${esc(content)}</div>`);
    scrollToBottom();
  }

  function showThinking() {
    log.insertAdjacentHTML('beforeend', `
      <div class="bubble assistant" id="thinking">
        <span class="who">${esc(modelLabel)}</span>
        <span class="thinking"><span class="dot"></span><span class="dot"></span><span class="dot"></span></span>
      </div>`);
    scrollToBottom();
  }

  function removeThinking() {
    const el = document.getElementById('thinking');
    if (el) el.remove();
  }

  function appendReply(reply) {
    log.insertAdjacentHTML('beforeend', messageHtml(reply));
    scrollToBottom();
  }

  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    appendLocal('user', text);
    sendBtn.disabled = true;
    showThinking();
    try {
      const { reply } = await api.post(`/api/cases/${caseId}/chat`, { message: text });
      removeThinking();
      appendReply(reply);
    } catch (e) {
      removeThinking();
      toast(e.message, 'err');
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      send();
    }
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
  });

  micBtn.addEventListener('click', async () => {
    if (mediaRec && mediaRec.state === 'recording') {
      mediaRec.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRec = new MediaRecorder(stream);
      chunks = [];
      mediaRec.ondataavailable = (ev) => chunks.push(ev.data);
      mediaRec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        micBtn.classList.remove('rec');
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const form = new FormData();
        form.append('audio', blob, 'voice.wav');
        appendLocal('system', 'Transcribing on-device…');
        try {
          const { reply } = await api.post(`/api/cases/${caseId}/chat/voice`, form, true);
          appendReply(reply);
          await loadHistory();
        } catch (e) {
          toast(e.message, 'err');
        }
      };
      mediaRec.start();
      micBtn.classList.add('rec');
      log.querySelector('.bubble.system:last-child')?.remove();
      appendLocal('system', '… listening locally — tap 🎤 again to finish');
    } catch {
      toast('Microphone unavailable. Use text input instead.', 'err');
    }
  });

  await loadHistory();
  rebuildHeader();
}