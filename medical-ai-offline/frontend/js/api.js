/* Thin JSON API client for the local backend. */
export const api = {
  async get(path) {
    const res = await fetch(path);
    return handle(res);
  },
  async post(path, body, isForm = false) {
    const opts = { method: 'POST', body: isForm ? body : JSON.stringify(body) };
    if (!isForm) opts.headers = { 'Content-Type': 'application/json' };
    const res = await fetch(path, opts);
    return handle(res);
  },
  async patch(path, body) {
    const res = await fetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return handle(res);
  },
  async del(path) {
    const res = await fetch(path, { method: 'DELETE' });
    return handle(res);
  },
};

async function handle(res) {
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const detail = data && data.detail ? data.detail : `HTTP ${res.status}`;
    throw new Error(detail);
  }
  return data;
}

export function mediaUrl(path) {
  return path;
}