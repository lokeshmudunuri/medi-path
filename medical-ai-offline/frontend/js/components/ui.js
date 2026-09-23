export function toast(message, kind = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

export function esc(text = '') {
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

export function fmtBytes(n) {
  if (n == null) return '?';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = Number(n);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
}

export function pillFor(state) {
  const map = {
    INSTALLED: ['ok', 'Installed'],
    READY: ['ok', 'Ready'],
    NOT_INSTALLED: ['neutral', 'Not installed'],
    DOWNLOADING: ['busy', 'Downloading'],
    DOWNLOAD_FINISHED: ['busy', 'Verifying…'],
    VERIFYING: ['busy', 'Verifying'],
    FAILED: ['err', 'Failed'],
    VERIFICATION_FAILED: ['err', 'Verification failed'],
    CORRUPTED: ['err', 'Corrupted'],
    PAUSED: ['warn', 'Paused'],
    QUEUED: ['warn', 'Queued'],
  };
  const [cls, label] = map[state] || ['neutral', state || 'Unknown'];
  return `<span class="pill ${cls}">${label}</span>`;
}

export function progressBar(record) {
  const pct = Math.round((record?.progress ?? 0) * 100);
  return `<div class="progress"><div style="width:${pct}%"></div></div>`;
}

export function confidenceBar(pct, opts = {}) {
  const v = Math.max(0, Math.min(100, Math.round((pct ?? 0) * 100)));
  const color = v >= 75 ? 'var(--ok)' : v >= 45 ? 'var(--warn)' : 'var(--danger)';
  const label = opts.label != null ? opts.label : `${v}% confidence`;
  return `
    <div class="conf">
      <div class="progress"><div style="width:${v}%;background:${color}"></div></div>
      <div class="tiny muted mt-8" style="margin-top:3px">${label}</div>
    </div>`;
}

export function emptyState(icon, title, body, actionHtml = '') {
  return `
    <div class="empty">
      <div class="empty-ic">${icon}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(body)}</p>
      ${actionHtml ? `<div class="btn-row" style="justify-content:center;margin-top:10px">${actionHtml}</div>` : ''}
    </div>`;
}

export function alertBox(kind, message) {
  const icon = kind === 'critical' ? '!' : kind === 'warning' ? '▲' : 'i';
  return `<div class="alert ${kind}"><span class="alert-icon">${icon}</span><div>${message}</div></div>`;
}