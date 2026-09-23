export async function render(host, navigate) {
  host.innerHTML = `
    <div class="page">
      <div class="page-head">
        <p class="eyebrow">Data Sovereignty &amp; Security</p>
        <h1>Privacy &amp; Local Execution Guarantee</h1>
        <p class="sub">LocalMed is designed from the ground up to ensure sensitive medical information never leaves your personal machine.</p>
      </div>

      <div class="card" style="padding:24px">
        <h2 style="margin-bottom:12px">Our 100% Offline Core Guarantees</h2>
        
        <div class="stack" style="gap:16px">
          <div style="display:flex;gap:12px;align-items:flex-start">
            <span style="font-size:22px;color:var(--ok)">🛡️</span>
            <div>
              <h3 style="margin:0 0 4px">Your Documents Stay on This Device</h3>
              <p class="small muted">Uploaded prescriptions, lab reports, image crops, and PDF files are stored strictly inside your local application directory (<code>data/cases/</code>). They are never sent to any external server or cloud bucket.</p>
            </div>
          </div>

          <div style="display:flex;gap:12px;align-items:flex-start">
            <span style="font-size:22px;color:var(--ok)">💻</span>
            <div>
              <h3 style="margin:0 0 4px">Local AI Inference (Gemma 3 1B)</h3>
              <p class="small muted">All document analysis, text simplification, and case chat are executed by local AI runtimes running directly on localhost (Ollama or on-device engines). No third-party LLM APIs (OpenAI, Anthropic, Gemini Cloud, etc.) are ever queried.</p>
            </div>
          </div>

          <div style="display:flex;gap:12px;align-items:flex-start">
            <span style="font-size:22px;color:var(--ok)">📚</span>
            <div>
              <h3 style="margin:0 0 4px">Deterministic Medical Knowledge Base</h3>
              <p class="small muted">Information on medicines, interactions, dosages, side effects, and diet rules is bundled directly with the application in an offline repository. If an item is unknown, the application explicitly states that it is missing rather than hallucinating answers.</p>
            </div>
          </div>

          <div style="display:flex;gap:12px;align-items:flex-start">
            <span style="font-size:22px;color:var(--ok)">🚫</span>
            <div>
              <h3 style="margin:0 0 4px">Zero Accounts, Zero Tracking, Zero Telemetry</h3>
              <p class="small muted">There are no logins, no analytics beacons, and no background health telemetry. You maintain complete ownership and control over your records.</p>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <p class="tiny muted">
          <strong>Note on Device Security:</strong> Because records are stored locally, please ensure your physical machine or device has standard disk encryption and screen lock enabled to safeguard your records.
        </p>

        <div class="btn-row mt-16">
          <button class="btn btn-primary" data-nav="home">Back to Home</button>
          <button class="btn btn-secondary" data-nav="cases">View Stored Cases</button>
        </div>
      </div>
    </div>
  `;

  host.querySelectorAll('[data-nav]').forEach((btn) => btn.addEventListener('click', () => navigate(btn.dataset.nav)));
}
