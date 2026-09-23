import { api } from '../api.js';
import { esc, fmtTime, toast, confidenceBar, emptyState } from '../components/ui.js';
import { renderChatPanel } from './chat-panel.js';

const TABS = [
  { id: 'overview', label: 'Key Overview' },
  { id: 'medicines', label: 'Medicines' },
  { id: 'reports', label: 'Reports' },
  { id: 'safety', label: 'Safety' },
  { id: 'diet', label: 'Diet / Food' },
  { id: 'chat', label: 'Chat with Case' },
];

export async function render(host, navigate, { id }) {
  let caseData = null;

  host.innerHTML = `
    <div class="page">
      <div class="page-head spread">
        <div>
          <button class="btn btn-sm btn-secondary mb-8" data-nav="back">← Back to cases</button>
          <div class="row">
            <h1 style="margin:0"><span id="case-name">…</span></h1>
            <button class="btn btn-secondary btn-sm" id="rename-btn">Rename</button>
            <button class="btn btn-danger btn-sm" data-nav="delete">Delete</button>
          </div>
          <p class="small muted" id="case-meta"></p>
        </div>
        <div class="row" style="gap:8px">
          <span class="chip" id="type-chip">Document</span>
          <span class="chip" id="ocr-chip">OCR: …</span>
        </div>
      </div>

      <div id="alerts"></div>

      <div class="tabs" id="case-tabs">
        ${TABS.map((t, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div id="case-body"></div>
    </div>
  `;

  host.querySelector('[data-nav="back"]').addEventListener('click', () => navigate('cases'));
  host.querySelector('[data-nav="delete"]').addEventListener('click', async () => {
    if (!confirm('Delete this case and all its local records? This cannot be undone.')) return;
    try {
      await api.del(`/api/cases/${id}`);
      toast('Case deleted.');
      navigate('cases');
    } catch (e) {
      toast(e.message, 'err');
    }
  });

  host.querySelector('#rename-btn').addEventListener('click', async () => {
    const newName = prompt('Enter new case name:', caseData?.name || '');
    if (!newName || !newName.trim()) return;
    try {
      await api.patch(`/api/cases/${id}`, { name: newName.trim() });
      toast('Case renamed.');
      await refresh();
    } catch (e) {
      toast(e.message, 'err');
    }
  });

  async function refresh() {
    const { case: c } = await api.get(`/api/cases/${id}`);
    caseData = c;
    document.getElementById('case-name').textContent = c.name;
    document.getElementById('case-meta').textContent =
      `Created ${fmtTime(c.created_at)} · Engine v${c.engine_version || '1.0.0'}`;
    document.getElementById('type-chip').textContent = (c.document_type || 'prescription').replace('_', ' ').toUpperCase();
    document.getElementById('ocr-chip').textContent = `OCR: ${(c.ocr_source || c.prescription?.ocr_engine || 'local').split(':')[0]}`;
    renderAlerts(document.getElementById('alerts'), c);
  }

  const tabButtons = [...host.querySelectorAll('#case-tabs .tab')];
  tabButtons.forEach((btn) => btn.addEventListener('click', async () => {
    tabButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    await showTab(btn.dataset.tab);
  }));

  async function showTab(tab) {
    if (!caseData) await refresh();
    const body = document.getElementById('case-body');
    if (tab === 'chat') {
      body.innerHTML = '';
      renderChatPanel(body, caseData.id, caseData);
      return;
    }
    body.innerHTML = renderTab(tab, caseData);
  }

  try {
    await refresh();
  } catch (e) {
    host.innerHTML = `<div class="error-card"><strong>Case not found.</strong><p class="small">${esc(e.message)}</p></div>`;
    return;
  }
  await showTab('overview');
}

function renderAlerts(el, c) {
  const flags = c.analysis?.safety_flags || [];
  const critical = flags.filter((f) => f.severity === 'critical');
  const warned = flags.filter((f) => f.severity === 'warning');

  let html = '';
  critical.forEach((f) => {
    html += `<div class="alert critical"><span class="alert-icon">!</span><div><strong>Critical Safety Flag.</strong> ${esc(f.message)}</div></div>`;
  });
  warned.slice(0, 2).forEach((f) => {
    html += `<div class="alert warning"><span class="alert-icon">▲</span><div><strong>Review Required.</strong> ${esc(f.message)}</div></div>`;
  });
  if (!html) {
    html += `<div class="alert info"><span class="alert-icon">i</span><div>Case data loaded. No critical conflicts reported by local medical engine.</div></div>`;
  }
  el.innerHTML = html;
}

function renderTab(tab, c) {
  if (tab === 'overview') return renderOverview(c);
  if (tab === 'medicines') return renderMedicines(c);
  if (tab === 'reports') return renderReports(c);
  if (tab === 'safety') return renderSafety(c);
  if (tab === 'diet') return renderDiet(c);
  return '';
}

/* ------------------------------------------------------------- Key Overview */
function renderOverview(c) {
  const p = c.prescription;
  const meds = p.medicines || [];
  const reports = c.lab_reports || [];
  const totalTests = reports.reduce((acc, r) => acc + (r.test_results?.length || 0), 0);
  const flags = c.analysis?.safety_flags || [];
  const reviewCount = meds.filter((m) => m.needs_verification && !m.verified_by_user).length +
    reports.reduce((acc, r) => acc + (r.test_results?.filter((t) => t.flag !== 'normal').length || 0), 0);

  return `
    <div class="grid-2" style="align-items:start">
      <div class="card">
        <p class="card-title">Document &amp; OCR Reading</p>
        <div class="row mb-8">
          <span class="chip">Confidence: ${Math.round((p.ocr_confidence || 0.8) * 100)}%</span>
          <span class="chip">Preserved Locally</span>
        </div>
        <img class="preview-box" style="max-height:220px" src="/api/cases/${esc(c.id)}/image" alt="Original document" loading="lazy">
        <div class="divider"></div>
        <p class="tiny muted">The original document is kept strictly on your local disk. It is never transmitted externally.</p>
      </div>

      <div class="card">
        <p class="card-title">Key Overview</p>
        <div style="background:var(--surface-alt);border:1px solid var(--border-soft);border-radius:12px;padding:16px;margin-bottom:14px">
          <div style="font-size:16px;font-weight:700;color:var(--ink);margin-bottom:8px">Case Summary</div>
          <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin:0">
            <div class="stat"><div class="n">${meds.length}</div><div class="l">Medicines</div></div>
            <div class="stat"><div class="n">${totalTests}</div><div class="l">Lab Tests</div></div>
            <div class="stat"><div class="n" ${reviewCount ? 'style="color:var(--warn)"' : ''}>${reviewCount}</div><div class="l">Need Review</div></div>
          </div>
        </div>

        <div class="stack">
          <div>
            <h3>Medical Engine Status</h3>
            <p class="small muted">Deterministic local rules identify indication, dosage, and food safety before any text explanation.</p>
          </div>
          <div>
            <h3>Active Safety Flags</h3>
            <p class="small ${flags.length ? 'muted' : 'muted'}">${flags.length} safety items registered. View Safety tab for complete itemization.</p>
          </div>
        </div>
      </div>
    </div>`;
}

/* ----------------------------------------------------------- Medicines */
function renderMedicines(c) {
  const meds = c.prescription?.medicines || [];
  const info = c.analysis?.medicine_information || [];

  if (!meds.length) {
    return `<div class="card">${emptyState('💊', 'No medicines identified', 'This case does not contain extracted medicine items (it may be a clinical lab report).')}</div>`;
  }

  const cards = meds.map((m) => {
    const kb = info.find((i) => i.name.toLowerCase() === m.name.toLowerCase()) || null;
    return `
      <div class="med-card">
        <div class="med-top">
          <div>
            <span class="med-name">${esc(m.name || 'Unidentified Medicine')}</span>
            ${kb && kb.found
              ? '<span class="pill ok" style="margin-left:6px">Local Knowledge Found</span>'
              : '<span class="pill warn" style="margin-left:6px">Not in Local Database — Verify with Doctor</span>'}
            ${m.verified_by_user ? '<span class="pill teal" style="margin-left:6px">Verified</span>' : ''}
          </div>
        </div>
        <div class="med-detail mt-8">
          ${esc([
            m.strength ? `Strength: ${m.strength}` : '',
            m.dosage ? `Dose: ${m.dosage}` : '',
            m.frequency ? `Freq: ${m.frequency}` : '',
            m.duration ? `Duration: ${m.duration}` : '',
            m.route !== 'unknown' ? `Route: ${m.route}` : '',
            m.timing !== 'unknown' ? `Timing: ${m.timing}` : '',
          ].filter(Boolean).join(' • ')) || 'No dosage details detected'}
        </div>
        ${confidenceBar(m.confidence, { label: `${Math.round((m.confidence || 0) * 100)}% extraction confidence` })}

        ${kb && kb.found ? `
          <div class="med-kb">
            <div class="row" style="gap:6px">
              ${kb.category ? `<span class="chip">${esc(kb.category)}</span>` : ''}
              ${kb.generic_name ? `<span class="chip">Generic: ${esc(kb.generic_name)}</span>` : ''}
            </div>
            <p class="small mt-8"><strong>What it is:</strong> ${esc(kb.indications_summary)}</p>
            ${kb.common_side_effects?.length ? `<p class="small muted"><strong>Side effects:</strong> ${esc(kb.common_side_effects.join('; '))}</p>` : ''}
            ${kb.cautions?.length ? `<p class="small muted"><strong>Important warnings:</strong> ${esc(kb.cautions.join('; '))}</p>` : ''}
          </div>` : `
          <div class="med-kb">
            <p class="small" style="color:var(--warn)">No local approved information available for this medicine. Always consult your prescriber.</p>
          </div>`}
      </div>`;
  }).join('');

  return `
    <div class="card">
      <p class="card-title">Extracted Medicines &amp; Knowledge Lookup</p>
      <p class="small muted mb-8">Extracted from original prescription directives and cross-referenced with the local medical repository.</p>
      ${cards}
    </div>`;
}

/* ----------------------------------------------------------- Reports */
function renderReports(c) {
  const reports = c.lab_reports || [];
  if (!reports.length || !reports.some((r) => r.test_results?.length)) {
    return `<div class="card">${emptyState('📊', 'No lab test reports found', 'This case was processed as a prescription. You can upload clinical lab reports separately.')}</div>`;
  }

  return `
    <div class="card">
      <p class="card-title">Clinical Diagnostic &amp; Lab Reports</p>
      <p class="small muted mb-8">Tests, extracted results, units, and official reference ranges. Never fabricated or guessed.</p>
      ${reports.map((rep) => `
        <div style="margin-bottom:20px">
          <div class="row" style="margin-bottom:8px">
            <span class="chip">${esc(rep.lab_name || 'Laboratory')}</span>
            ${rep.date ? `<span class="chip">Date: ${esc(rep.date)}</span>` : ''}
            <span class="chip">Confidence: ${Math.round((rep.ocr_confidence || 0.85) * 100)}%</span>
          </div>
          <table class="report-table">
            <thead>
              <tr>
                <th>Diagnostic Test</th>
                <th>Extracted Result</th>
                <th>Reference Range</th>
                <th>Status Indicator</th>
              </tr>
            </thead>
            <tbody>
              ${(rep.test_results || []).map((t) => `
                <tr>
                  <td><strong>${esc(t.test_name)}</strong></td>
                  <td>${esc(t.result)} ${esc(t.unit)}</td>
                  <td class="muted tiny">${esc(t.reference_range || 'n/a')}</td>
                  <td><span class="flag-badge ${esc(t.flag)}">${esc(t.flag)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    </div>`;
}

/* ------------------------------------------------------------- Safety */
function renderSafety(c) {
  const flags = c.analysis?.safety_flags || [];
  const warnings = c.analysis?.warnings || [];

  const list = flags.map((f) => `
    <div class="flag ${esc(f.severity)}">
      <span class="sev">${esc(f.severity)}</span> — ${esc(f.message)}
      ${f.medicine ? `<div class="evidence">Subject: ${esc(f.medicine)}</div>` : ''}
      ${f.evidence ? `<div class="evidence">Source: ${esc(f.evidence)}</div>` : ''}
    </div>`).join('') || '<p class="muted">No safety alerts reported by the local engine.</p>';

  return `
    <div class="card">
      <p class="card-title">Safety &amp; Uncertainty Layer</p>
      <p class="small muted mb-8">The SafetyValidator checks for low OCR confidence, unverified medicines, missing frequencies, interactions, and abnormal test ranges.</p>
      ${list}
      ${warnings.length ? `<div class="divider"></div><h3>Engine Warnings</h3>${warnings.map((w) => `<p class="small muted">• ${esc(w)}</p>`).join('')}` : ''}
    </div>`;
}

/* ----------------------------------------------------------- Diet / Food */
function renderDiet(c) {
  const diet = c.analysis?.diet_rules || [];
  const takeaways = c.analysis?.takeaways || [];

  const dItems = diet.map((d) => `
    <div class="med-card" style="margin-top:0">
      <div class="row">
        <span class="pill teal">${esc(d.medicine)}</span>
        <span style="font-size:14px">${esc(d.text)}</span>
      </div>
    </div>`).join('') || '<p class="muted">No specific food/diet rules recorded for the current medicines in this case.</p>';

  const tItems = takeaways.map((t) => `
    <div class="med-card" style="margin-top:0">
      <div class="row">
        <span class="pill teal">${esc(t.medicine)}</span>
        <span style="font-size:14px">${esc(t.text)}</span>
      </div>
    </div>`).join('') || '<p class="muted">No additional instructions recorded.</p>';

  return `
    <div class="grid-2" style="align-items:start">
      <div class="card">
        <p class="card-title">Food &amp; Diet Information</p>
        <p class="small muted mb-8">Supported solely by the local knowledge base. The AI is prevented from inventing diet rules.</p>
        <div class="stack">${dItems}</div>
      </div>
      <div class="card">
        <p class="card-title">Important Takeaways</p>
        <div class="stack">${tItems}</div>
      </div>
    </div>`;
}