import { api } from '../api.js';
import { esc, fmtTime, emptyState } from '../components/ui.js';
import { renderModelStatus } from '../components/model-status.js';

export async function render(host, navigate) {
  host.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow" style="letter-spacing:1.5px">Medical AI • Private • Local • Offline</p>
        <h1>Understand prescriptions &amp; reports, privately on this device.</h1>
        <p class="sub">Upload a doctor's prescription or clinical lab report. The deterministic local medical engine extracts and explains tests and medicines. On-device AI answers your questions — grounded strictly in your case data.</p>
        <div class="btn-row mt-16">
          <button class="btn btn-primary btn-lg" data-nav="scan">＋ New Case</button>
          <button class="btn btn-lg" data-nav="cases" style="background:rgba(255,255,255,0.14);color:#fff">My Cases</button>
        </div>
      </div>
      <div class="hero-cta">
        <div class="flow-strip" style="background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.18)">
          <span class="step" style="color:#dff1fa">Document</span><span class="arrow">→</span>
          <span class="step" style="color:#dff1fa">On-Device OCR</span><span class="arrow">→</span>
          <span class="step" style="color:#dff1fa">Extraction</span><span class="arrow">→</span>
          <span class="step" style="color:#dff1fa">Local Knowledge</span><span class="arrow">→</span>
          <span class="step" style="color:#dff1fa">Safety Validator</span><span class="arrow">→</span>
          <span class="step" style="color:#dff1fa">Local AI</span>
        </div>
      </div>
    </section>

    <div class="grid-2">
      <div id="llm-status"></div>
      <div class="card">
        <p class="card-title">Your cases</p>
        <div id="stats-box"><p class="small muted">Loading…</p></div>
        <div class="btn-row mt-12">
          <button class="btn btn-secondary btn-sm" data-nav="cases">Open My Cases</button>
        </div>
      </div>
    </div>

    <div class="card mt-8" style="margin-top:16px">
      <p class="card-title">How it protects you</p>
      <div class="grid-2" style="gap:14px">
        <div>
          <h3>Local medical engine is authoritative</h3>
          <p class="small muted">Medicine, safety, interaction and diet information come from the bundled
          deterministic knowledge base on this device — not from the AI.</p>
        </div>
        <div>
          <h3>AI explains, never invents</h3>
          <p class="small muted">The local model only rephrases and explains information already supplied by the
          engine and your scanned prescription. If information is missing, it says so.</p>
        </div>
      </div>
    </div>
  `;

  host.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.nav)));

  const statusEl = document.getElementById('llm-status');
  await renderModelStatus(statusEl, { dark: true });

  loadStats(document.getElementById('stats-box'), navigate);
}

async function loadStats(el, navigate) {
  try {
    const { cases } = await api.get('/api/cases');
    const critical = cases.filter((c) =>
      (c.analysis?.safety_flags || []).some((f) => f.severity === 'critical')).length;
    const medicines = cases.reduce((n, c) => n + (c.prescription?.medicines?.length || 0), 0);
    const recent = cases[0];

    el.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><div class="n">${cases.length}</div><div class="l">Cases</div></div>
        <div class="stat"><div class="n">${medicines}</div><div class="l">Medicines</div></div>
        <div class="stat"><div class="n" ${critical ? 'style="color:var(--danger)"' : ''}>${critical}</div><div class="l">Critical flags</div></div>
      </div>
      ${recent ? `<p class="small muted">Most recent: <strong>${esc(recent.name)}</strong> · ${fmtTime(recent.updated_at)}</p>` : ''}`;
    if (!cases.length) {
      el.innerHTML += emptyState(
        '🩺', 'No cases yet',
        'Create your first case by uploading a prescription. Everything stays on this device.',
        '<button class="btn btn-primary btn-sm" data-nav="scan">Create a case</button>',
      );
      el.querySelectorAll('[data-nav]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
    }
  } catch (e) {
    el.innerHTML = `<p class="small" style="color:var(--danger)">Could not load case statistics: ${esc(e.message)}</p>`;
  }
}