import { renderChatPanel } from './chat-panel.js';
import { esc, toast, emptyState } from '../components/ui.js';
import { api } from '../api.js';

export async function render(host, navigate) {
  host.innerHTML = `
    <div class="page">
      <div class="page-head">
        <p class="eyebrow">Grounded answers</p>
        <h1>Chat about a case</h1>
        <p class="sub">Ask questions about a prescription. The local model explains the extracted information and
        medical-engine results — it does not add new medical facts.</p>
      </div>
      <div id="chat-root"></div>
    </div>
  `;

  const root = document.getElementById('chat-root');
  let cases = [];
  try {
    const res = await api.get('/api/cases');
    cases = res.cases;
  } catch (e) { toast(e.message, 'err'); }

  if (!cases.length) {
    root.innerHTML = `<div class="card">${emptyState(
      '💬',
      'You need a case before chatting',
      'Scan a prescription first — chat answers are grounded in that case.',
      '<button class="btn btn-primary btn-sm" data-nav="scan">Create a case</button>',
    )}</div>`;
    root.querySelectorAll('[data-nav]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
    return;
  }

  root.innerHTML = `
    <div class="card" style="padding:14px 16px">
      <div class="row">
        <label class="small muted" for="case-select" style="white-space:nowrap">Case:</label>
        <select id="case-select" aria-label="Choose case">
          ${cases.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="chat-panel"></div>
  `;

  function activate(caseId) {
    const panel = document.getElementById('chat-panel');
    panel.innerHTML = '';
    const c = cases.find((x) => x.id === caseId) || null;
    renderChatPanel(panel, caseId, c);
  }

  document.getElementById('case-select').addEventListener('change', (ev) => activate(ev.target.value));
  activate(cases[0].id);
}