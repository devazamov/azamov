import { WebSocketServer } from 'ws';
import { verifyToken } from './auth.js';
import * as store from './store.js';

// userId -> Set<WebSocket>
const clients = new Map();

function addClient(userId, ws) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(ws);
}
function removeClient(userId, ws) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) clients.delete(userId);
}
export function isOnline(userId) {
  return clients.has(userId);
}

function sendTo(userId, type, payload) {
  const set = clients.get(userId);
  if (!set) return;
  const data = JSON.stringify({ type, payload });
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

// HTTP qatlami uchun: ma'lum foydalanuvchiga hodisa yuborish
export function notifyUser(type, userId, payload) {
  sendTo(userId, type, payload);
}

// Chatdagi barcha a'zolarga yuborish
function broadcastToChat(chatId, type, payload, exceptUserId = null) {
  for (const uid of store.getChatMemberIds(chatId)) {
    if (uid === exceptUserId) continue;
    sendTo(uid, type, payload);
  }
}

export function attachWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = verifyToken(url.searchParams.get('token'));
    if (!userId) { ws.close(4001, 'auth'); return; }

    ws.userId = userId;
    ws.isAlive = true;
    addClient(userId, ws);

    // Suhbatdoshlarga online ekanligini bildirish
    broadcastPresence(userId, true);

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      handleClientMessage(ws, msg);
    });

    ws.on('close', () => {
      removeClient(userId, ws);
      if (!isOnline(userId)) broadcastPresence(userId, false);
    });

    ws.send(JSON.stringify({ type: 'ready', payload: { userId } }));
  });

  // Har 30 soniyada o'lik ulanishlarni tozalash
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);
  wss.on('close', () => clearInterval(interval));

  return wss;
}

function handleClientMessage(ws, msg) {
  const me = ws.userId;
  switch (msg.type) {
    case 'message': {
      const { chatId, body, attachId, tempId } = msg.payload || {};
      if (!store.isMember(chatId, me)) return;
      if (!body && !attachId) return;
      const saved = store.addMessage(chatId, me, body, attachId || null);
      // Yuboruvchiga tempId bilan tasdiq, qolganlarga oddiy
      sendTo(me, 'message', { ...saved, tempId });
      broadcastToChat(chatId, 'message', saved, me);
      break;
    }
    case 'typing': {
      const { chatId } = msg.payload || {};
      if (!store.isMember(chatId, me)) return;
      const user = store.getUserById(me);
      broadcastToChat(chatId, 'typing', { chatId, userId: me, name: user.display_name }, me);
      break;
    }
    case 'read': {
      const { chatId } = msg.payload || {};
      if (!store.isMember(chatId, me)) return;
      broadcastToChat(chatId, 'read', { chatId, userId: me }, me);
      break;
    }
  }
}

function broadcastPresence(userId, online) {
  // userId qatnashgan barcha chatlardagi odamlarga xabar ber
  const seen = new Set();
  for (const chat of store.listChats(userId)) {
    for (const uid of chat.members) {
      if (uid === userId || seen.has(uid)) continue;
      seen.add(uid);
      sendTo(uid, 'presence', { userId, online });
    }
  }
}
