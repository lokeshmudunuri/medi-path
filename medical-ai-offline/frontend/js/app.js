import { toast } from './components/ui.js';

const VIEW = document.getElementById('app-view');

const ROUTES = {
  home: () => import('./views/home.js'),
  scan: () => import('./views/scan.js'),
  cases: () => import('./views/cases.js'),
  case: () => import('./views/case.js'),
  chat: () => import('./views/chat.js'),
  settings: () => import('./views/settings.js'),
  privacy: () => import('./views/privacy.js'),
  'model-setup': () => import('./views/model-setup.js'),
};

const NAV = [
  { name: 'home', label: 'Home' },
  { name: 'scan', label: 'New Case' },
  { name: 'cases', label: 'My Cases' },
  { name: 'chat', label: 'Chat' },
  { name: 'model-setup', label: 'Model Manager' },
  { name: 'privacy', label: 'Privacy' },
  { name: 'settings', label: 'Settings' },
];

const BRAND_MARK = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M3 12h4l3-7 4 14 3-7h4" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

function renderShell() {
  const header = document.getElementById('app-header');
  header.innerHTML = `
    <div class="header-inner">
      <div class="brand-row" data-nav="home">
        <span class="brand-mark">${BRAND_MARK}</span>
        <span class="brand-name">LocalMed</span>
        <span class="brand-tag">offline medical assistant</span>
      </div>
      <nav class="app-nav" id="app-nav">
        ${NAV.map((n) => `<button data-nav="${n.name}">${n.label}</button>`).join('')}
      </nav>
    </div>`;

  header.querySelector('.brand-row').addEventListener('click', () => navigate('home'));
  header.querySelectorAll('#app-nav button').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.dataset.nav));
  });

  const footer = document.getElementById('app-footer');
  footer.innerHTML = `
    <div class="footer-inner">
      <span>LocalMed · fully local processing — no cloud, no account, no telemetry</span>
      <span id="footer-model"></span>
    </div>`;
}

function setActive(name) {
  const highlight = name === 'case' ? 'cases' : name;
  document.querySelectorAll('#app-nav button').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.nav === highlight);
  });
}

export async function navigate(name, params = {}) {
  const loader = ROUTES[name] || ROUTES.home;
  let mod;
  try {
    mod = await loader();
  } catch (e) {
    console.error(e);
    toast(`Could not load view "${name}"`, 'err');
    mod = await ROUTES.home();
  }
  setActive(name);
  VIEW.innerHTML = '';
  try {
    await mod.render(VIEW, navigate, params);
  } catch (e) {
    console.error(e);
    VIEW.innerHTML = `
      <div class="error-card">
        <strong>Something went wrong.</strong>
        <div class="small mt-8">${e.message}</div>
      </div>`;
  }
  window.scrollTo(0, 0);
}

window.appNav = navigate;

async function showBackendOffline() {
  VIEW.innerHTML = `
    <div class="empty" style="padding-top:80px">
      <div class="empty-ic">📡</div>
      <h3>Backend offline</h3>
      <p>Start the LocalMed server, then reload.</p>
      <div class="btn-row" style="justify-content:center;margin-top:8px">
        <button class="btn btn-primary" onclick="location.reload()">Reload</button>
      </div>
    </div>`;
}

async function boot() {
  renderShell();
  try {
    const health = await fetch('/api/health');
    if (!health.ok) throw new Error('backend');
  } catch {
    await showBackendOffline();
    return;
  }

  try {
    const status = await fetch('/api/llm/status').then((r) => r.json());
    const el = document.getElementById('footer-model');
    if (el) {
      const tag = status.connected ? status.model_name : 'AI: offline sample mode';
      el.textContent = tag;
      if (status.connected) el.style.color = '#7fb8de';
    }
  } catch { /* footer stays clean */ }

  await navigate('home');
}

boot();