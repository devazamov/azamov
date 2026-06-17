// Backend manzili. Lokalda bo'sh — Vite proxy ishlatiladi.
// Netlify'da VITE_API_URL env beriladi, masalan https://azamov.onrender.com
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

// Biriktirilgan fayl uchun to'liq URL
export function fileUrl(path) {
  return API_BASE + path;
}

let token = localStorage.getItem('token') || null;

export function getToken() { return token; }
export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
}

async function request(path, { method = 'GET', body, raw } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let payload = body;
  if (body && !raw) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(API_BASE + path, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Xato: ${res.status}`);
  return data;
}

export const api = {
  register: (b) => request('/api/register', { method: 'POST', body: b }),
  login: (b) => request('/api/login', { method: 'POST', body: b }),
  me: () => request('/api/me'),
  searchUsers: (q) => request(`/api/users/search?q=${encodeURIComponent(q)}`),
  chats: () => request('/api/chats'),
  openPrivate: (userId) => request('/api/chats/private', { method: 'POST', body: { userId } }),
  createGroup: (title, memberIds) => request('/api/chats/group', { method: 'POST', body: { title, memberIds } }),
  messages: (chatId, before) =>
    request(`/api/messages?chatId=${chatId}${before ? `&before=${before}` : ''}`),
  upload: async (file) => {
    const res = await fetch(API_BASE + '/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': file.type || 'application/octet-stream',
        'X-Filename': encodeURIComponent(file.name),
      },
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Yuklash xatosi');
    return data.attachment;
  },
};

// --- WebSocket ulanish menejeri ---
export function connectSocket(onEvent, onStatus) {
  let ws = null;
  let closedByUser = false;
  let retry = 0;

  function open() {
    let wsUrl;
    if (API_BASE) {
      wsUrl = API_BASE.replace(/^http/, 'ws') + `/ws?token=${token}`;
    } else {
      wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?token=${token}`;
    }
    ws = new WebSocket(wsUrl);
    ws.onopen = () => { retry = 0; onStatus?.('online'); };
    ws.onmessage = (e) => {
      try { const { type, payload } = JSON.parse(e.data); onEvent(type, payload); } catch {}
    };
    ws.onclose = () => {
      onStatus?.('offline');
      if (closedByUser) return;
      retry = Math.min(retry + 1, 6);
      setTimeout(open, retry * 1000);
    };
    ws.onerror = () => ws?.close();
  }
  open();

  return {
    send: (type, payload) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type, payload }));
    },
    close: () => { closedByUser = true; ws?.close(); },
  };
}
