import crypto from 'node:crypto';
import { createWriteStream, createReadStream, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { UPLOAD_DIR, MAX_UPLOAD_BYTES } from './config.js';
import { hashPassword, verifyPassword, createToken, verifyToken } from './auth.js';
import * as store from './store.js';

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.txt': 'text/plain', '.zip': 'application/zip',
  '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.json': 'application/json',
};

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Filename',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

function readBody(req, limit = 1 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  return JSON.parse(buf.toString());
}

function authUser(req) {
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const uid = verifyToken(token);
  return uid ? store.getUserById(uid) : null;
}

// Notify callback har bir yangi xabar uchun WebSocket'ga uzatiladi
export function createHttpHandler(onMessage) {
  return async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === 'OPTIONS') return json(res, 204, {});

    try {
      // --- Statik fayllar ---
      if (req.method === 'GET' && path.startsWith('/files/')) {
        return serveFile(res, path.slice('/files/'.length));
      }

      // --- Auth: register ---
      if (req.method === 'POST' && path === '/api/register') {
        const { username, displayName, password } = await readJson(req);
        if (!username || !password || username.length < 3 || password.length < 4) {
          return json(res, 400, { error: 'Username (3+) va parol (4+) kerak' });
        }
        const clean = String(username).toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (!clean) return json(res, 400, { error: 'Username faqat harf, raqam, _' });
        if (store.getUserByUsername(clean)) return json(res, 409, { error: 'Bu username band' });
        const user = store.createUser(clean, displayName || clean, hashPassword(password));
        return json(res, 200, { token: createToken(user.id), user: store.publicUser(user) });
      }

      // --- Auth: login ---
      if (req.method === 'POST' && path === '/api/login') {
        const { username, password } = await readJson(req);
        const u = store.getUserByUsername(String(username || '').toLowerCase());
        if (!u || !verifyPassword(password || '', u.password_hash)) {
          return json(res, 401, { error: 'Username yoki parol xato' });
        }
        return json(res, 200, { token: createToken(u.id), user: store.publicUser(u) });
      }

      // --- Quyidagilar uchun auth talab qilinadi ---
      const me = authUser(req);
      if (!me) return json(res, 401, { error: 'Avtorizatsiya kerak' });

      if (req.method === 'GET' && path === '/api/me') {
        return json(res, 200, { user: store.publicUser(me) });
      }

      if (req.method === 'GET' && path === '/api/users/search') {
        const q = url.searchParams.get('q') || '';
        return json(res, 200, { users: store.searchUsers(q, me.id) });
      }

      if (req.method === 'GET' && path === '/api/chats') {
        return json(res, 200, { chats: store.listChats(me.id) });
      }

      // Shaxsiy chat ochish (yoki mavjudini olish)
      if (req.method === 'POST' && path === '/api/chats/private') {
        const { userId } = await readJson(req);
        const other = store.getUserById(Number(userId));
        if (!other) return json(res, 404, { error: 'Foydalanuvchi topilmadi' });
        const chatId = store.getOrCreatePrivateChat(me.id, other.id);
        return json(res, 200, { chat: store.decorateChat(store.getChatById(chatId), me.id) });
      }

      // Guruh yaratish
      if (req.method === 'POST' && path === '/api/chats/group') {
        const { title, memberIds } = await readJson(req);
        if (!title || !Array.isArray(memberIds) || memberIds.length < 1) {
          return json(res, 400, { error: 'Guruh nomi va a\'zolar kerak' });
        }
        const ids = [me.id, ...memberIds.map(Number)];
        const chatId = store.createChat('group', String(title), me.id, ids);
        const chat = store.decorateChat(store.getChatById(chatId), me.id);
        // Boshqa a'zolarga xabar ber
        for (const uid of ids) if (uid !== me.id) onMessage('chat_created', uid, { chat: store.decorateChat(store.getChatById(chatId), uid) });
        return json(res, 200, { chat });
      }

      // Xabarlar tarixi
      if (req.method === 'GET' && path === '/api/messages') {
        const chatId = Number(url.searchParams.get('chatId'));
        const before = url.searchParams.get('before');
        if (!store.isMember(chatId, me.id)) return json(res, 403, { error: 'Ruxsat yo\'q' });
        const msgs = store.listMessages(chatId, before ? Number(before) : null);
        return json(res, 200, { messages: msgs });
      }

      // Fayl yuklash: xom binary, X-Filename header bilan
      if (req.method === 'POST' && path === '/api/upload') {
        return handleUpload(req, res, me);
      }

      return json(res, 404, { error: 'Topilmadi' });
    } catch (err) {
      console.error('HTTP xato:', err.message);
      return json(res, 500, { error: 'Server xatosi' });
    }
  };
}

async function handleUpload(req, res, me) {
  const origName = decodeURIComponent(req.headers['x-filename'] || 'file');
  const mime = req.headers['content-type'] || 'application/octet-stream';
  let buf;
  try {
    buf = await readBody(req, MAX_UPLOAD_BYTES);
  } catch {
    return json(res, 413, { error: 'Fayl juda katta (max 25MB)' });
  }
  if (!buf.length) return json(res, 400, { error: 'Bo\'sh fayl' });

  const safeExt = extname(origName).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
  const filename = crypto.randomBytes(16).toString('hex') + safeExt;
  await new Promise((resolve, reject) => {
    const ws = createWriteStream(join(UPLOAD_DIR, filename));
    ws.on('error', reject);
    ws.on('finish', resolve);
    ws.end(buf);
  });

  const id = store.createAttachment(filename, origName, mime, buf.length, me.id);
  return json(res, 200, {
    attachment: { id, url: `/files/${filename}`, name: origName, mime, size: buf.length, isImage: mime.startsWith('image/') },
  });
}

function serveFile(res, name) {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, '');
  const full = join(UPLOAD_DIR, safe);
  if (!full.startsWith(UPLOAD_DIR) || !existsSync(full)) {
    res.writeHead(404); return res.end('Not found');
  }
  const ext = extname(full).toLowerCase();
  const stat = statSync(full);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000',
  });
  createReadStream(full).pipe(res);
}

export { authUser };
