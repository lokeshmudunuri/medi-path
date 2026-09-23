import { api } from '../api.js';
import { esc, fmtBytes, pillFor, progressBar, toast } from './ui.js';

export async function renderModels(container, { compact = false } = {}) {
  const { models } = await api.get('/api/models');
  container.innerHTML = models.map(({ definition, status }) => `
    <div class="model-row" id="row-${definition.id}" style="align-items:flex-start">
      <div class="meta" style="flex:1">
        <div class="name" style="font-weight:700;font-size:15px">${esc(definition.name)}</div>
        <div class="small muted" style="margin-top:2px">
          ${definition.description ? `<div><b>Purpose:</b> ${esc(definition.description)}</div>` : ''}
          <div><b>Runtime:</b> ${esc(definition.runtime || 'local')} · <b>Size:</b> ${fmtBytes(definition.total_size_bytes)} · <b>Accel:</b> ${esc(definition.quantization || 'CPU')}</div>
          ${definition.source ? `<div><b>Source:</b> <a href="${esc(definition.source)}" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline">${esc(definition.source)}</a></div>` : ''}
          <div style="margin-top:4px"><span data-pill="${definition.id}">${pillFor(status.state)}</span></div>
        </div>
      </div>
      <div class="btn-row" style="max-width:180px">
        <button class="btn btn-secondary btn-sm" data-act="download" data-id="${definition.id}">Download</button>
        <button class="btn btn-danger btn-sm" data-act="delete" data-id="${definition.id}">Delete</button>
      </div>
    </div>
    <div data-progress="${definition.id}" class="${compact ? 'hidden' : ''}"></div>
  `).join('');

  container.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      const { act, id } = btn.dataset;
      btn.disabled = true;
      try {
        if (act === 'download') {
          await api.post(`/api/models/${id}/download`);
          toast(`Started download: ${id}`);
          await pollModel(id);
        } else if (act === 'delete') {
          await api.del(`/api/models/${id}`);
          toast(`Deleted model: ${id}`);
          await renderModels(container, { compact });
        }
      } catch (e) {
        toast(e.message, 'err');
      } finally {
        btn.disabled = false;
      }
    });
  });
}

async function pollModel(id) {
  for (let i = 0; i < 400; i++) {
    try {
      const { status } = await api.get(`/api/models/${id}/progress`);
      const pill = document.querySelector(`[data-pill="${id}"]`);
      if (pill) pill.innerHTML = pillFor(status.state);
      const progressEl = document.querySelector(`[data-progress="${id}"]`);
      if (progressEl && (status.state === 'DOWNLOADING' || status.state === 'VERIFYING' || status.state === 'DOWNLOAD_FINISHED')) {
        progressEl.innerHTML = progressBar(status) + `<div class="small muted">${fmtBytes(status.bytes_done)} / ${fmtBytes(status.bytes_total)}</div>`;
      }
      if (['INSTALLED', 'READY', 'FAILED', 'VERIFICATION_FAILED', 'PAUSED', 'NOT_INSTALLED'].includes(status.state)) {
        break;
      }
    } catch { break; }
    await new Promise((r) => setTimeout(r, 1200));
  }
}