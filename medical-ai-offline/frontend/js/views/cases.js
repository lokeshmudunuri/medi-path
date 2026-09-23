import { api } from '../api.js';
import { esc, fmtTime, toast, emptyState } from '../components/ui.js';

export async function render(host, navigate) {
  host.innerHTML = `
    <div class="page">
      <div class="page-head spread">
        <div>
          <p class="eyebrow">Local On-Device Records</p>
          <h1>My Cases</h1>
          <p class="sub">All medical documents, extracted medicines, lab reports, and grounded conversations remain securely on your device.</p>
        </div>
        <button class="btn btn-primary" data-nav="scan">＋ New Case</button>
      </div>

      <div class="card" style="padding:12px 16px">
        <input id="search" placeholder="Search cases by name, medicine, or test result…" autocomplete="off" aria-label="Search cases">
      </div>
      <div id="case-list"></div>
    </div>
  `;

  host.querySelectorAll('[data-nav]').forEach((el) => el.addEventListener('click', () => navigate(el.dataset.nav)));
  await loadCases(navigate);

  const search = document.getElementById('search');
  search.addEventListener('input', debounce(async () => {
    const q = search.value.trim();
    try {
      const { cases } = q
        ? await api.get(`/api/cases/search?q=${encodeURIComponent(q)}`)
        : await api.get('/api/cases');
      renderList(document.getElementById('case-list'), cases, navigate);
    } catch (e) {
      toast(e.message, 'err');
    }
  }, 250));
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

async function loadCases(navigate) {
  try {
    const { cases } = await api.get('/api/cases');
    renderList(document.getElementById('case-list'), cases, navigate);
  } catch (e) {
    toast(e.message, 'err');
  }
}

function renderList(el, cases, navigate) {
  if (!cases.length) {
    el.innerHTML = emptyState(
      '📁',
      'No cases stored yet',
      'Add your first prescription or clinical report to begin on-device analysis.',
      '<button class="btn btn-primary btn-sm" data-nav="scan">Create New Case</button>',
    );
    el.querySelectorAll('[data-nav]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
    return;
  }

  el.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${cases.map((c) => {
        const meds = (c.prescription?.medicines || []).map((m) => m.name).filter(Boolean);
        const labTests = (c.lab_reports || []).flatMap((r) => r.test_results || []).map((t) => t.test_name);
        const critical = (c.analysis?.safety_flags || []).some((f) => f.severity === 'critical');
        const warned = (c.analysis?.safety_flags || []).some((f) => f.severity === 'warning');
        const ocr = (c.ocr_source || c.prescription?.ocr_engine || 'local').split(':')[0];
        const docCount = (c.original_documents?.length) || (c.prescription?.source_image ? 1 : 0);

        return `
          <div class="card case-tile" data-case="${c.id}">
            <div class="spread">
              <div>
                <span class="name">${esc(c.name)}</span>
                <div class="tiny muted mt-8">
                  Created ${fmtTime(c.created_at)} • Updated ${fmtTime(c.updated_at)} • ${docCount} document(s)
                </div>
              </div>
              <div class="row">
                ${critical ? '<span class="pill err">Critical Alert</span>' : ''}
                ${warned && !critical ? '<span class="pill warn">Needs Review</span>' : ''}
                <span class="chip">${esc(c.document_type || 'prescription')}</span>
                <span class="chip">OCR: ${esc(ocr)}</span>
              </div>
            </div>
            
            <div class="meds">
              ${meds.length ? meds.map((m) => `<span class="chip" style="margin:2px 4px 2px 0">💊 ${esc(m)}</span>`).join('') : ''}
              ${labTests.length ? labTests.slice(0, 5).map((t) => `<span class="chip" style="margin:2px 4px 2px 0">🔬 ${esc(t)}</span>`).join('') : ''}
              ${!meds.length && !labTests.length ? '<span class="muted tiny">No structured entities extracted</span>' : ''}
            </div>
          </div>`;
      }).join('')}
    </div>`;

  el.querySelectorAll('.case-tile').forEach((tile) => {
    tile.addEventListener('click', () => navigate('case', { id: tile.dataset.case }));
  });
}