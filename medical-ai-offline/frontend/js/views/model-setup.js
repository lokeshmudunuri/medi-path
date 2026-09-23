import { api } from '../api.js';
import { fmtBytes, toast } from '../components/ui.js';
import { renderModels } from '../components/models.js';
import { renderModelStatus } from '../components/model-status.js';

export async function render(host, navigate) {
  host.innerHTML = `
    <div class="page">
      <div class="page-head">
        <p class="eyebrow">First run</p>
        <h1>AI components</h1>
        <p class="sub">These local models power OCR, speech, voice and the chat explanation layer.
        Nothing is sent to the internet — downloads happen only when you start them.</p>
      </div>

      <div id="llm-status" style="margin-bottom:16px"></div>

      <div class="card">
        <p class="card-title">Required AI components</p>
        <div id="storage-line" class="small muted mb-8">Checking storage…</div>
        <div id="model-list"></div>
        <div class="btn-row mt-12">
          <button class="btn btn-primary" id="download-all">Download pending models</button>
          <button class="btn btn-secondary" data-nav="home">Continue to Home</button>
        </div>
      </div>
    </div>
  `;

  host.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.nav)));
  await renderModelStatus(document.getElementById('llm-status'));
  await renderModels(document.getElementById('model-list'));

  try {
    const required = await api.get('/api/models/required');
    document.getElementById('storage-line').innerHTML =
      `Total recommended: <b>${fmtBytes(required.total_bytes)}</b> · Free storage: <b>${fmtBytes(required.free_storage_bytes)}</b>`;
  } catch (e) {
    document.getElementById('storage-line').textContent = `Could not read storage: ${e.message}`;
  }

  document.getElementById('download-all').addEventListener('click', async () => {
    const btn = document.getElementById('download-all');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Starting…';
    try {
      const { required } = await api.get('/api/models/required');
      for (const m of required) {
        if (m.files.length === 0) continue; // bundled knowledge base
        try {
          await api.post(`/api/models/${m.id}/download`);
        } catch (e) { toast(e.message, 'err'); }
      }
      toast('Downloads started. Track progress below.');
    } catch (e) {
      toast(e.message, 'err');
    }
    btn.innerHTML = 'Download pending models';
    btn.disabled = false;
    await renderModels(document.getElementById('model-list'));
  });
}