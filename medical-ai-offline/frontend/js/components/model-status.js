/* Model Status panel — reads the real backend state from /api/llm/status.
   Never invents connectivity: in mock/test mode the backend reports
   provider="mock" and the panel shows the offline sample state. */
import { esc } from './ui.js';

export async function renderModelStatus(el, { dark = false } = {}) {
  el.innerHTML = '<p class="small muted">Checking local AI…</p>';
  let status;
  try {
    status = await fetch('/api/llm/status').then((r) => r.json());
  } catch (e) {
    el.innerHTML = `<p class="small" style="color:var(--danger)">Model status unavailable: ${esc(e.message)}</p>`;
    return;
  }

  const connected = Boolean(status.connected && status.provider === 'ollama');
  const isTarget = Boolean(status.is_target_model);
  const pillClass = connected ? (isTarget ? 'ok' : 'warn') : status.ollama_reachable ? 'warn' : 'err';
  const pillLabel = isTarget
    ? 'Installed & Active'
    : status.ollama_reachable
      ? 'Not Installed (Fallback Active)'
      : 'Local AI Offline';

  const isCodingModel = (status.active_model || status.model_name || '').toLowerCase().includes('coder');
  const activeLabel = isTarget
    ? esc(status.model_name || 'Gemma 3 1B')
    : isCodingModel
      ? `${esc(status.active_model || status.model_name)} (Coding Model — LLM Fallback)`
      : esc(status.active_model || status.model_name || '—');

  const rows = `
    <div class="ms-row"><span class="ms-key">Target AI</span><span class="ms-val ms-model">${esc(status.target_model || 'Gemma 3 1B')} (Medical Extraction/Chat)</span></div>
    <div class="ms-row"><span class="ms-key">Target Status</span><span class="ms-val"><span class="pill ${pillClass}">${pillLabel}</span></span></div>
    <div class="ms-row"><span class="ms-key">Active Model</span><span class="ms-val ms-model">${activeLabel}</span></div>
    <div class="ms-row"><span class="ms-key">Runtime</span><span class="ms-val">Local (On-Device)</span></div>
    <div class="ms-row"><span class="ms-key">Cloud API</span><span class="ms-val"><span class="pill neutral">None • Zero Cloud Calls</span></span></div>`;

  const noteHtml = esc(status.note || 'Medical facts are strictly sourced from the local database; the local AI explains and clarifies without inventing.');

  el.innerHTML = `
    <div class="${dark ? 'ms-panel' : 'ms-card card'}">
      <p class="ms-head">Local AI Model Status</p>
      <div class="ms-list">${rows}</div>
      <p class="ms-note">${noteHtml}</p>
    </div>`;
}