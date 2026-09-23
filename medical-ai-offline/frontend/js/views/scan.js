import { api } from '../api.js';
import { esc, toast, confidenceBar } from '../components/ui.js';

let currentBlob = null;
let currentFilename = 'document.jpg';
let currentCase = null;

const PIPELINE_STAGES = [
  { id: 'reading', label: 'Uploading & Reading document' },
  { id: 'ocr', label: 'OCR processing (on-device vision)' },
  { id: 'extract', label: 'Extracting medical & report information' },
  { id: 'knowledge', label: 'Checking local knowledge base' },
  { id: 'preparing', label: 'Preparing case & safety validation' },
];

export async function render(host, navigate) {
  host.innerHTML = `
    <div class="page">
      <div class="page-head">
        <p class="eyebrow">Offline Medical Ingestion</p>
        <h1>Create a Medical Case</h1>
        <p class="sub">Add a doctor's prescription or clinical diagnostic report. All image reading, text parsing, and safety checks happen strictly on this machine.</p>
      </div>

      <div class="grid-2" style="align-items:start">
        <div class="card">
          <p class="card-title">1 · Case Details &amp; Document</p>
          
          <div style="margin-bottom:14px">
            <label class="tiny muted" for="case-name-input" style="display:block;font-weight:700;margin-bottom:4px">CASE NAME</label>
            <input id="case-name-input" placeholder="e.g. Dad — Blood Pressure, Mom — Blood Test" autocomplete="off">
          </div>

          <div style="margin-bottom:14px">
            <label class="tiny muted" style="display:block;font-weight:700;margin-bottom:4px">DOCUMENT TYPE</label>
            <div class="row" style="gap:16px">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="radio" name="doc-type" value="prescription" checked> Prescription
              </label>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
                <input type="radio" name="doc-type" value="lab_report"> Medical / Lab Report
              </label>
            </div>
          </div>

          <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload document image or PDF">
            <div class="dz-icon">📄</div>
            <div><strong>Drop prescription or lab report</strong> or browse files</div>
            <div class="tiny mt-8" style="color:var(--muted-2)">Supports JPG, PNG, WebP &amp; PDF · 100% on-device</div>
          </div>
          <input type="file" id="file-input" accept="image/*,.pdf" class="hidden">

          <div class="btn-row mt-12">
            <button class="btn btn-secondary btn-sm" id="btn-gallery">Browse files</button>
            <button class="btn btn-secondary btn-sm" id="btn-camera">Use camera</button>
          </div>

          <div class="divider"></div>
          <p class="tiny muted">Or use a bundled realistic test file:</p>
          <div class="btn-row">
            <button class="btn btn-soft btn-sm" id="btn-sample-rx">Sample Prescription (Rx)</button>
            <button class="btn btn-soft btn-sm" id="btn-sample-lab">Sample Lab Report (CBC/Metabolic)</button>
          </div>

          <div id="preview" class="mt-16 hidden"></div>
        </div>

        <div class="card">
          <p class="card-title">2 · Processing &amp; Extraction Review</p>
          <div id="action-zone">
            <p class="small muted">Once an image or document is loaded, processing executes sequentially through the on-device pipeline.</p>
            <div class="btn-row mt-12">
              <button class="btn btn-primary" id="btn-process" disabled>Process on device</button>
            </div>
          </div>
          <div id="verify-zone"></div>
        </div>
      </div>
    </div>
  `;

  const dropzone = document.getElementById('dropzone');
  dropzone.addEventListener('click', () => document.getElementById('file-input').click());
  dropzone.addEventListener('dragover', (ev) => { ev.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (ev) => {
    ev.preventDefault();
    dropzone.classList.remove('drag');
    const file = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (file) setDocumentFile(file);
  });

  document.getElementById('btn-gallery').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('file-input').addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (file) setDocumentFile(file);
  });

  document.getElementById('btn-camera').addEventListener('click', captureFromCamera);
  document.getElementById('btn-sample-rx').addEventListener('click', () => useSampleFixture('paracetamol_sample.jpg', 'prescription', 'Personal — Prescription'));
  document.getElementById('btn-sample-lab').addEventListener('click', () => useSampleFixture('sample_lab_report.jpg', 'lab_report', 'Dad — Blood Test'));
  document.getElementById('btn-process').addEventListener('click', () => runProcessingPipeline(navigate));
}

function setDocumentFile(fileOrBlob, filename = 'document.jpg') {
  currentBlob = fileOrBlob;
  currentFilename = fileOrBlob.name || filename;
  const preview = document.getElementById('preview');
  preview.classList.remove('hidden');

  if (currentFilename.endsWith('.pdf')) {
    preview.innerHTML = `
      <div style="padding:16px;background:var(--surface-alt);border:1px solid var(--border);border-radius:10px;text-align:center">
        <span style="font-size:28px">📑</span>
        <div style="font-weight:600;margin-top:4px">${esc(currentFilename)}</div>
        <div class="tiny muted">PDF document ready for offline processing</div>
      </div>`;
  } else {
    const url = URL.createObjectURL(fileOrBlob);
    preview.innerHTML = `<img src="${url}" alt="Document preview" style="max-height:220px;border-radius:8px">`;
  }

  document.getElementById('btn-process').disabled = false;
  toast('Document ready. Press “Process on device”.');
}

function useSampleFixture(filename, docType, defaultName) {
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 180;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#222';
  ctx.font = '14px sans-serif';
  ctx.fillText(docType === 'lab_report' ? 'Clinical Lab Report Sample' : 'Prescription Sample', 20, 40);

  canvas.toBlob((blob) => {
    const file = new File([blob], filename, { type: 'image/jpeg' });
    const radio = document.querySelector(`input[name="doc-type"][value="${docType}"]`);
    if (radio) radio.checked = true;
    const nameInput = document.getElementById('case-name-input');
    if (nameInput && !nameInput.value.trim()) nameInput.value = defaultName;
    setDocumentFile(file, filename);
  }, 'image/jpeg');
}

async function captureFromCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.setAttribute('playsinline', '');
    video.style.width = '100%';
    video.style.borderRadius = '12px';
    const box = document.getElementById('preview');
    box.innerHTML = '';
    box.classList.remove('hidden');
    box.appendChild(video);
    await new Promise((res) => { video.onloadedmetadata = () => { video.play(); res(); }; });

    const shot = document.createElement('button');
    shot.className = 'btn btn-primary mt-8';
    shot.style.width = '100%';
    shot.textContent = 'Capture photo';
    box.appendChild(shot);
    shot.addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 960;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      stream.getTracks().forEach((t) => t.stop());
      canvas.toBlob((blob) => setDocumentFile(blob, 'camera_capture.jpg'), 'image/jpeg', 0.92);
    }, { once: true });
  } catch {
    toast('Camera unavailable — please browse files instead.', 'err');
  }
}

async function runProcessingPipeline(navigate) {
  if (!currentBlob) return;
  const action = document.getElementById('action-zone');
  const userCaseName = (document.getElementById('case-name-input')?.value || '').trim();
  const docType = document.querySelector('input[name="doc-type"]:checked')?.value || 'prescription';

  // Check whether required OCR model is installed before processing real images
  try {
    const { models } = await api.get('/api/models');
    const ocrModel = models.find((m) => m.definition.id === 'ocr-rapidocr');
    const isInstalled = ocrModel && ['INSTALLED', 'READY'].includes(ocrModel.status.state);
    
    // Check if current upload is a sample fixture
    const isSample = ['paracetamol_sample.jpg', 'sample_lab_report.jpg'].includes(currentFilename);
    
    if (!isInstalled && !isSample) {
      renderModelRequiredScreen(ocrModel?.definition, navigate);
      return;
    }
  } catch (err) {
    console.warn('Model pre-check failed, continuing:', err);
  }

  action.innerHTML = `
    <p style="font-weight:700;margin-bottom:10px">Sequential On-Device Processing</p>
    <div class="steps" id="steps">
      ${PIPELINE_STAGES.map((s, i) => `
        <div class="step" data-step="${i}"><span class="step-ic">${i + 1}</span><span>${esc(s.label)}</span></div>
      `).join('')}
    </div>
    <p class="tiny muted mt-12">All models run strictly on localhost. No cloud transmission.</p>
  `;

  const stepEls = [...document.querySelectorAll('#steps .step')];
  let phase = 0;
  const ticker = setInterval(() => {
    if (phase > 0 && phase - 1 < stepEls.length) stepEls[phase - 1].classList.add('done');
    if (phase < stepEls.length) {
      stepEls[phase].classList.add('active');
      stepEls[phase].querySelector('.step-ic').innerHTML = '<span class="spinner"></span>';
    }
    phase += 1;
  }, 450);

  const form = new FormData();
  form.append('image', currentBlob, currentFilename);
  form.append('name', userCaseName);
  form.append('document_type', docType);

  try {
    const { case: created } = await api.post('/api/cases', form, true);
    currentCase = created;
    clearInterval(ticker);
    stepEls.forEach((el) => {
      el.classList.remove('active');
      el.classList.add('done');
      el.querySelector('.step-ic').textContent = '✓';
    });
    await renderExtractionReview(navigate);
  } catch (e) {
    clearInterval(ticker);
    toast(e.message, 'err');
    action.innerHTML = `<p class="small" style="color:var(--danger)">Processing failed: ${esc(e.message)}</p>`;
  }
}

function renderModelRequiredScreen(def, navigate) {
  const action = document.getElementById('action-zone');
  const modelName = def?.name || 'Prescription OCR (RapidOCR PaddleOCR-lite)';
  const modelSize = def?.total_size_bytes ? `${(def.total_size_bytes / 1024 / 1024).toFixed(1)} MB` : '15.7 MB';
  const modelSource = def?.source || 'https://huggingface.co/SWHL/RapidOCR';
  const modelPurpose = def?.description || 'Handwritten prescription / medical document analysis';

  action.innerHTML = `
    <div class="card" style="border:2px solid var(--primary);background:var(--surface);padding:18px;border-radius:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:22px">⚠️</span>
        <span style="font-weight:800;font-size:16px;letter-spacing:0.5px;color:var(--primary)">MODEL REQUIRED</span>
      </div>
      <p style="font-size:14px;line-height:1.4;margin-bottom:12px">
        To analyze this prescription locally, LocalMed needs the required OCR/Vision model.
      </p>

      <div style="background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:13px;line-height:1.6;margin-bottom:16px">
        <div><strong>Model:</strong> ${esc(modelName)}</div>
        <div><strong>Purpose:</strong> ${esc(modelPurpose)}</div>
        <div><strong>Runs:</strong> 100% locally on device</div>
        <div><strong>Cloud:</strong> No cloud transmission</div>
        <div><strong>Download size:</strong> ${esc(modelSize)}</div>
        <div><strong>Source:</strong> <a href="${esc(modelSource)}" target="_blank" rel="noopener" style="color:var(--primary);text-decoration:underline">${esc(modelSource)}</a></div>
      </div>

      <div id="dl-progress-box" class="hidden mb-12"></div>

      <div class="btn-row" style="flex-direction:column;gap:8px">
        <button class="btn btn-primary btn-lg" id="btn-dl-model" style="width:100%;font-size:15px;padding:12px">
          DOWNLOAD MODEL (${esc(modelSize)})
        </button>
        <a class="btn btn-secondary btn-sm" href="${esc(modelSource)}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none;display:block">
          VIEW SOURCE
        </a>
      </div>
    </div>
  `;

  document.getElementById('btn-dl-model').addEventListener('click', async () => {
    const btn = document.getElementById('btn-dl-model');
    const progBox = document.getElementById('dl-progress-box');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Starting download…';
    progBox.classList.remove('hidden');
    progBox.innerHTML = '<div class="progress"><div style="width:10%"></div></div><div class="tiny muted mt-4">Connecting to official repository…</div>';

    try {
      await api.post('/api/models/ocr-rapidocr/download');
      
      // Poll progress until complete
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const { status } = await api.get('/api/models/ocr-rapidocr/progress');
        const pct = Math.round((status.progress || 0) * 100);
        progBox.innerHTML = `
          <div class="progress"><div style="width:${Math.max(pct, 5)}%"></div></div>
          <div class="tiny muted mt-4" style="display:flex;justify-content:space-between">
            <span>Status: ${esc(status.state)}</span>
            <span>${pct}%</span>
          </div>
        `;

        if (status.state === 'INSTALLED' || status.state === 'READY') {
          toast('OCR Model installed successfully! Continuing processing automatically…');
          btn.textContent = 'Installed! Processing…';
          // Automatically continue the New Case pipeline without losing the image
          setTimeout(() => runProcessingPipeline(navigate), 800);
          return;
        }
        if (status.state === 'FAILED' || status.state === 'VERIFICATION_FAILED') {
          progBox.innerHTML = `<div class="small" style="color:var(--danger)">Download failed: ${esc(status.error || 'Unknown error')}</div>`;
          btn.disabled = false;
          btn.textContent = 'RETRY DOWNLOAD';
          return;
        }
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = 'RETRY DOWNLOAD';
      progBox.innerHTML = `<div class="small" style="color:var(--danger)">Error: ${esc(e.message)}</div>`;
    }
  });
}

function renderExtractionReview(navigate) {
  const zone = document.getElementById('verify-zone');
  const c = currentCase;
  const p = c.prescription;
  const meds = p.medicines || [];
  const reports = c.lab_reports || [];

  let contentHtml = '';

  if (reports.length && reports[0].test_results?.length) {
    const rep = reports[0];
    contentHtml += `
      <div style="margin-bottom:14px">
        <span class="chip">Lab Report</span>
        ${rep.lab_name ? `<span class="chip">${esc(rep.lab_name)}</span>` : ''}
        ${rep.date ? `<span class="chip">Date: ${esc(rep.date)}</span>` : ''}
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th>Test Name</th>
            <th>Result</th>
            <th>Reference</th>
            <th>Status</th>
            <th>Verify</th>
          </tr>
        </thead>
        <tbody>
          ${rep.test_results.map((t, i) => `
            <tr>
              <td><strong>${esc(t.test_name)}</strong></td>
              <td>${esc(t.result)} ${esc(t.unit)}</td>
              <td class="muted tiny">${esc(t.reference_range || 'n/a')}</td>
              <td><span class="flag-badge ${esc(t.flag)}">${esc(t.flag)}</span></td>
              <td>
                <input type="checkbox" data-verify-report="${i}" ${t.verified_by_user ? 'checked' : ''}>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  }

  if (meds.length) {
    contentHtml += `
      <div style="margin-top:14px">
        <span class="chip">Prescription Medicines</span>
      </div>
      <div class="stack mt-8">
        ${meds.map((m, i) => `
          <div class="med-card">
            <div class="med-top">
              <div>
                <span class="med-name">${esc(m.name || 'Unidentified medicine')}</span>
                ${m.needs_verification ? '<span class="pill warn" style="margin-left:6px">Review Required</span>' : '<span class="pill ok" style="margin-left:6px">Recognized</span>'}
              </div>
              <span class="tiny muted">${Math.round((m.confidence || 0) * 100)}% OCR confidence</span>
            </div>
            <div class="med-detail">${esc([m.strength, m.dosage, m.frequency, m.duration, m.route !== 'unknown' ? m.route : '', m.timing !== 'unknown' ? m.timing : ''].filter(Boolean).join(' · ')) || 'No dosage details extracted'}</div>
            <label class="switch mt-8">
              <input type="checkbox" data-verify-med="${i}" ${m.verified_by_user ? 'checked' : ''}>
              I confirm this medicine name and instructions
            </label>
          </div>
        `).join('')}
      </div>`;
  }

  if (!meds.length && (!reports.length || !reports[0].test_results?.length)) {
    contentHtml = `<p class="muted">No medicines or structured test entries could be extracted automatically. You can still save the case and review it in chat.</p>`;
  }

  const flags = (c.analysis?.safety_flags || []).map((f) => `
    <div class="flag ${esc(f.severity)}">
      <span class="sev">${esc(f.severity)}</span> — ${esc(f.message)}
    </div>
  `).join('');

  const ocrConfPct = Math.round((p.ocr_confidence || 0) * 100);
  const rawOcrText = p.raw_ocr_text || '';

  zone.innerHTML = `
    <div style="padding-top:10px">
      <div class="card" style="background:var(--surface)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <p class="card-title" style="margin:0">DOCUMENT ANALYSIS</p>
          <div style="text-align:right">
            <span class="tiny muted" style="text-transform:uppercase;letter-spacing:0.5px">OCR CONFIDENCE</span>
            <div style="font-weight:700;color:var(--primary);font-size:16px">${ocrConfPct}%</div>
          </div>
        </div>

        ${rawOcrText ? `
          <div style="margin-bottom:14px;background:var(--surface-alt);border:1px solid var(--border);border-radius:8px;padding:10px">
            <div class="tiny muted" style="font-weight:700;margin-bottom:4px;letter-spacing:0.5px">EXTRACTED TEXT</div>
            <pre style="margin:0;font-size:12px;white-space:pre-wrap;font-family:monospace;max-height:120px;overflow-y:auto;color:var(--text)">${esc(rawOcrText)}</pre>
          </div>
        ` : ''}

        <p class="card-title" style="margin-top:12px">MEDICINES DETECTED &amp; STRUCTURED EXTRACTION</p>
        ${contentHtml}
        ${flags ? `<div class="mt-12">${flags}</div>` : ''}
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" id="btn-confirm">Save Case and View Overview</button>
        <button class="btn btn-secondary" id="btn-discard">Discard</button>
      </div>
    </div>
  `;

  zone.querySelector('#btn-confirm').addEventListener('click', async () => {
    const medVerified = [...zone.querySelectorAll('input[data-verify-med]:checked')].map((el) => ({ index: el.dataset.verifyMed }));
    const repVerified = [...zone.querySelectorAll('input[data-verify-report]:checked')].map((el) => ({ index: el.dataset.verifyReport }));

    if (medVerified.length) {
      try {
        await api.post(`/api/cases/${currentCase.id}/verify`, { verified: medVerified });
      } catch (e) {
        toast(e.message, 'err');
      }
    }
    if (repVerified.length) {
      try {
        await api.post(`/api/cases/${currentCase.id}/verify-reports`, { verified: repVerified });
      } catch (e) {
        toast(e.message, 'err');
      }
    }
    navigate('case', { id: currentCase.id });
  });

  zone.querySelector('#btn-discard').addEventListener('click', () => navigate('cases'));
}