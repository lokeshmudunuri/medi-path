import { api } from '../api.js';
import { fmtBytes, toast, esc } from '../components/ui.js';
import { renderModels } from '../components/models.js';

export async function render(host, navigate) {
  host.innerHTML = `
    <div class="splash">
      <div class="logo">🏥</div>
      <h1>LocalMed</h1>
      <p>Offline-first on-device medical assistant.<br>No cloud. No accounts. Your data stays on this device.</p>
      <div id="health-card" class="card" style="margin-top:20px">
        <div class="small muted">Checking local services…</div>
      </div>
      <div style="margin-top:16px">
        <button class="btn" id="go-home">Continue</button>
      </div>
    </div>
  `;

  try {
    const health = await api.get('/api/health');
    const required = await api.get('/api/models/required');
    document.getElementById('health-card').innerHTML = `
      <h3>Local status</h3>
      <p>✔ Offline-only application · free storage: <b>${fmtBytes(health.free_storage_bytes)}</b></p>
      <p>Required AI components: ${required.required.length}</p>
      <p class="small muted">Models below must be installed once. Downloads happen on this device only.</p>
    `;
  } catch (e) {
    document.getElementById('health-card').innerHTML = `<p class="small" style="color:var(--danger)">Backend unreachable: ${esc(e.message)}</p>`;
  }

  document.getElementById('go-home').addEventListener('click', () => navigate('home'));
}