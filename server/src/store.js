import { db } from './db.js';

const now = () => Date.now();

const COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'];
function pickColor(seed) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

// --- Users ---
export function createUser(username, displayName, passwordHash) {
  const r = db.prepare(
    `INSERT INTO users (username, display_name, password_hash, avatar_color, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(username, displayName, passwordHash, pickColor(username), now());
  return getUserById(Number(r.lastInsertRowid));
}

export function getUserByUsername(username) {
  return db.prepare(`SELECT * FROM users WHERE username = ?`).get(username);
}

export function getUserById(id) {
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, displayName: u.display_name, avatarColor: u.avatar_color };
}

export function searchUsers(query, exceptId) {
  return db.prepare(
    `SELECT * FROM users
     WHERE (username LIKE ? OR display_name LIKE ?) AND id != ?
     ORDER BY display_name LIMIT 20`
  ).all(`%${query}%`, `%${query}%`, exceptId).map(publicUser);
}

// --- Chats ---
export function findPrivateChat(a, b) {
  return db.prepare(
    `SELECT c.* FROM chats c
     JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = ?
     JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = ?
     WHERE c.type = 'private' LIMIT 1`
  ).get(a, b);
}

export function createChat(type, title, createdBy, memberIds) {
  const ts = now();
  const r = db.prepare(
    `INSERT INTO chats (type, title, created_by, created_at) VALUES (?, ?, ?, ?)`
  ).run(type, title, createdBy, ts);
  const chatId = Number(r.lastInsertRowid);
  const add = db.prepare(
    `INSERT OR IGNORE INTO chat_members (chat_id, user_id, joined_at) VALUES (?, ?, ?)`
  );
  for (const uid of new Set(memberIds)) add.run(chatId, uid, ts);
  return chatId;
}

export function getOrCreatePrivateChat(a, b) {
  const existing = findPrivateChat(a, b);
  if (existing) return existing.id;
  return createChat('private', null, a, [a, b]);
}

export function getChatMemberIds(chatId) {
  return db.prepare(`SELECT user_id FROM chat_members WHERE chat_id = ?`)
    .all(chatId).map(r => r.user_id);
}

export function isMember(chatId, userId) {
  return !!db.prepare(
    `SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?`
  ).get(chatId, userId);
}

// Foydalanuvchining barcha chatlari + oxirgi xabar + suhbatdosh ma'lumoti
export function listChats(userId) {
  const chats = db.prepare(
    `SELECT c.* FROM chats c
     JOIN chat_members m ON m.chat_id = c.id
     WHERE m.user_id = ?`
  ).all(userId);

  const result = chats.map(c => decorateChat(c, userId));
  result.sort((a, b) => (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
  return result;
}

export function decorateChat(c, userId) {
  const last = db.prepare(
    `SELECT m.*, u.display_name AS sender_name FROM messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT 1`
  ).get(c.id);

  let title = c.title;
  let peer = null;
  let avatarColor = '#3390ec';
  if (c.type === 'private') {
    const other = db.prepare(
      `SELECT u.* FROM chat_members m JOIN users u ON u.id = m.user_id
       WHERE m.chat_id = ? AND m.user_id != ?`
    ).get(c.id, userId);
    if (other) {
      peer = publicUser(other);
      title = other.display_name;
      avatarColor = other.avatar_color;
    }
  }

  return {
    id: c.id,
    type: c.type,
    title: title || 'Guruh',
    avatarColor,
    peer,
    members: getChatMemberIds(c.id),
    createdAt: c.created_at,
    lastMessage: last ? formatMessage(last) : null,
  };
}

export function getChatById(chatId) {
  return db.prepare(`SELECT * FROM chats WHERE id = ?`).get(chatId);
}

// --- Messages ---
export function addMessage(chatId, senderId, body, attachId = null) {
  const r = db.prepare(
    `INSERT INTO messages (chat_id, sender_id, body, attach_id, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(chatId, senderId, body || null, attachId, now());
  return getMessageById(Number(r.lastInsertRowid));
}

export function getMessageById(id) {
  const m = db.prepare(
    `SELECT m.*, u.display_name AS sender_name, u.username AS sender_username,
            u.avatar_color AS sender_color
     FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
  ).get(id);
  return m ? formatMessage(m) : null;
}

export function listMessages(chatId, beforeId = null, limit = 50) {
  const rows = beforeId
    ? db.prepare(
        `SELECT m.*, u.display_name AS sender_name, u.username AS sender_username,
                u.avatar_color AS sender_color
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.chat_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`
      ).all(chatId, beforeId, limit)
    : db.prepare(
        `SELECT m.*, u.display_name AS sender_name, u.username AS sender_username,
                u.avatar_color AS sender_color
         FROM messages m JOIN users u ON u.id = m.sender_id
         WHERE m.chat_id = ? ORDER BY m.id DESC LIMIT ?`
      ).all(chatId, limit);
  return rows.reverse().map(formatMessage);
}

function formatMessage(m) {
  let attachment = null;
  if (m.attach_id) {
    const a = db.prepare(`SELECT * FROM attachments WHERE id = ?`).get(m.attach_id);
    if (a) {
      attachment = {
        id: a.id,
        url: `/files/${a.filename}`,
        name: a.orig_name,
        mime: a.mime,
        size: a.size,
        isImage: a.mime.startsWith('image/'),
      };
    }
  }
  return {
    id: m.id,
    chatId: m.chat_id,
    senderId: m.sender_id,
    senderName: m.sender_name,
    senderColor: m.sender_color,
    body: m.body,
    attachment,
    createdAt: m.created_at,
  };
}

// --- Attachments ---
export function createAttachment(filename, origName, mime, size, userId) {
  const r = db.prepare(
    `INSERT INTO attachments (filename, orig_name, mime, size, uploaded_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(filename, origName, mime, size, userId, now());
  return Number(r.lastInsertRowid);
}
