import { api } from '../api.js';
import { esc, fmtBytes, toast } from '../components/ui.js';
import { renderModels } from '../components/models.js';
import { renderModelStatus } from '../components/model-status.js';

export async function render(host, navigate) {
  host.innerHTML = `
    <div class="page">
      <div class="page-head">
        <p class="eyebrow">Preferences &amp; runtime</p>
        <h1>Settings</h1>
        <p class="sub">Manage the on-device AI components and review privacy.</p>
      </div>

      <div id="llm-status"></div>

      <div class="card setting-section">
        <p class="card-title">AI components</p>
        <p class="small muted">OCR, speech and voice models are downloaded once and stored on this device.
        The language model is managed by your local Ollama runtime.</p>
        <div id="model-list"></div>
        <div class="btn-row mt-12">
          <button class="btn btn-soft btn-sm" data-nav="model-setup">Open model setup</button>
        </div>
      </div>

      <div class="card setting-section">
        <p class="card-title">Storage</p>
        <div id="storage-info"><p class="small muted">Loading…</p></div>
      </div>

      <div class="card setting-section">
        <p class="card-title">Privacy</p>
        <ul class="privacy-list" style="list-style:none;padding:0;margin:0">
          <li><span class="ck">✔</span> Prescriptions, OCR text, cases, chat and voice stay on this device.</li>
          <li><span class="ck">✔</span> No cloud APIs, no telemetry, no account, no internet needed for inference.</li>
          <li><span class="ck">✔</span> The AI chat is an explanation layer grounded in the local medical engine.</li>
          <li><span class="ck">✔</span> Internet is only used when you choose to download a new model.</li>
        </ul>
      </div>

      <div class="card setting-section">
        <p class="card-title">Danger zone</p>
        <p class="small muted">Remove all downloaded models (not your cases) and return to the model setup screen. The
        language model is also removed from Ollama if it was pulled through the app.</p>
        <button class="btn btn-danger btn-sm" id="reset">Reset models to first run</button>
      </div>
    </div>
  `;

  host.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.nav)));

  await renderModelStatus(document.getElementById('llm-status'));
  await renderModels(document.getElementById('model-list'));

  try {
    const required = await api.get('/api/models/required');
    document.getElementById('storage-info').innerHTML = `
      <dl class="kv mt-8">
        <dt>Required download</dt><dd>${fmtBytes(required.total_bytes)}</dd>
        <dt>Free storage</dt><dd>${fmtBytes(required.free_storage_bytes)}</dd>
      </dl>
      <p class="tiny muted mt-8">Models are stored in <span class="code">data/models</span> on this device.</p>`;
  } catch (e) {
    document.getElementById('storage-info').innerHTML = `<p class="small" style="color:var(--danger)">${esc(e.message)}</p>`;
  }

  document.getElementById('reset').addEventListener('click', async () => {
    if (!confirm('Remove all downloaded models (NOT your cases) and return to the model setup screen?')) return;
    try {
      const { models } = await api.get('/api/models');
      for (const { definition } of models) {
        await api.del(`/api/models/${definition.id}`);
      }
      toast('Models reset.');
      navigate('model-setup');
    } catch (e) {
      toast(e.message, 'err');
    }
  });
}