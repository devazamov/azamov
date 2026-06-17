import { auth, db, storage } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where,
  orderBy, onSnapshot, getDocs, serverTimestamp, limit, arrayUnion,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'];
function pickColor(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

const toMillis = (ts) => (ts?.toMillis ? ts.toMillis() : (ts || Date.now()));

// ---------- AUTH ----------
export async function register({ email, password, displayName }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const username = email.split('@')[0].toLowerCase();
  const profile = {
    uid,
    email,
    username,
    displayName: displayName || username,
    nameLower: (displayName || username).toLowerCase(),
    avatarColor: pickColor(uid),
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', uid), profile);
  return profile;
}

export async function login({ email, password }) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  await signOut(auth);
}

// Auth holatini kuzatib, foydalanuvchi profilini qaytaradi
export function onAuth(cb) {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) { cb(null); return; }
    const snap = await getDoc(doc(db, 'users', fbUser.uid));
    if (snap.exists()) {
      const u = snap.data();
      cb({ id: u.uid, ...u });
    } else {
      // Profil yo'q bo'lsa minimal yaratamiz
      const username = (fbUser.email || 'user').split('@')[0].toLowerCase();
      const profile = {
        uid: fbUser.uid, email: fbUser.email, username,
        displayName: username, nameLower: username,
        avatarColor: pickColor(fbUser.uid),
        createdAt: serverTimestamp(), lastActive: serverTimestamp(),
      };
      await setDoc(doc(db, 'users', fbUser.uid), profile);
      cb({ id: fbUser.uid, ...profile });
    }
  });
}

function publicUser(u) {
  return { id: u.uid, uid: u.uid, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor };
}

// ---------- USERS ----------
export async function searchUsers(qText, exceptUid) {
  const text = qText.trim().toLowerCase();
  if (!text) return [];
  const snap = await getDocs(query(collection(db, 'users'), limit(50)));
  return snap.docs
    .map((d) => d.data())
    .filter((u) => u.uid !== exceptUid &&
      (u.username?.includes(text) || u.nameLower?.includes(text)))
    .slice(0, 20)
    .map(publicUser);
}

export function subscribeUser(uid, cb) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    if (snap.exists()) cb(snap.data());
  });
}

// ---------- PRESENCE ----------
export function startPresence(uid) {
  const update = () => updateDoc(doc(db, 'users', uid), { lastActive: serverTimestamp() }).catch(() => {});
  update();
  const id = setInterval(update, 25000);
  return () => clearInterval(id);
}

export function isUserOnline(userData) {
  const last = toMillis(userData?.lastActive);
  return Date.now() - last < 60000;
}

// ---------- CHATS ----------
function decorate(id, c, meId) {
  let title = c.title || 'Guruh';
  let avatarColor = '#3390ec';
  let peer = null;
  if (c.type === 'private') {
    const otherId = (c.members || []).find((m) => m !== meId);
    const info = c.memberInfo?.[otherId];
    if (info) {
      peer = { id: otherId, uid: otherId, displayName: info.displayName, avatarColor: info.avatarColor };
      title = info.displayName;
      avatarColor = info.avatarColor;
    }
  }
  const lm = c.lastMessage;
  return {
    id,
    type: c.type,
    title,
    avatarColor,
    peer,
    members: c.members || [],
    createdAt: toMillis(c.createdAt),
    lastMessage: lm ? { ...lm, createdAt: toMillis(lm.createdAt) } : null,
  };
}

export function subscribeChats(meId, cb) {
  const q = query(collection(db, 'chats'), where('members', 'array-contains', meId));
  return onSnapshot(q, (snap) => {
    const chats = snap.docs.map((d) => decorate(d.id, d.data(), meId));
    chats.sort((a, b) =>
      (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
    cb(chats);
  });
}

export async function openPrivateChat(me, other) {
  // Mavjud shaxsiy chatni qidiramiz
  const q = query(collection(db, 'chats'), where('members', 'array-contains', me.id));
  const snap = await getDocs(q);
  const existing = snap.docs.find((d) => {
    const c = d.data();
    return c.type === 'private' && (c.members || []).includes(other.id);
  });
  if (existing) return existing.id;

  const ref = await addDoc(collection(db, 'chats'), {
    type: 'private',
    members: [me.id, other.id],
    memberInfo: {
      [me.id]: { displayName: me.displayName, avatarColor: me.avatarColor },
      [other.id]: { displayName: other.displayName, avatarColor: other.avatarColor },
    },
    createdBy: me.id,
    createdAt: serverTimestamp(),
    lastMessage: null,
    typing: {},
  });
  return ref.id;
}

export async function createGroup(me, title, members) {
  const ids = [me.id, ...members.map((u) => u.id)];
  const memberInfo = { [me.id]: { displayName: me.displayName, avatarColor: me.avatarColor } };
  for (const u of members) memberInfo[u.id] = { displayName: u.displayName, avatarColor: u.avatarColor };
  const ref = await addDoc(collection(db, 'chats'), {
    type: 'group',
    title,
    members: ids,
    memberInfo,
    createdBy: me.id,
    createdAt: serverTimestamp(),
    lastMessage: null,
    typing: {},
  });
  return ref.id;
}

// ---------- MESSAGES ----------
export function subscribeMessages(chatId, cb) {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt'), limit(200));
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map((d) => {
      const m = d.data();
      return { id: d.id, ...m, createdAt: toMillis(m.createdAt) };
    });
    cb(msgs);
  });
}

export async function sendMessage(chatId, me, { body, attachment }) {
  const msg = {
    senderId: me.id,
    senderName: me.displayName,
    senderColor: me.avatarColor,
    body: body || null,
    attachment: attachment || null,
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'chats', chatId, 'messages'), msg);
  await updateDoc(doc(db, 'chats', chatId), {
    lastMessage: {
      body: body || null,
      attachment: attachment ? { isImage: attachment.isImage } : null,
      senderName: me.displayName,
      senderId: me.id,
      createdAt: serverTimestamp(),
    },
  });
}

// ---------- TYPING ----------
export async function setTyping(chatId, me) {
  await updateDoc(doc(db, 'chats', chatId), {
    [`typing.${me.id}`]: { name: me.displayName, at: Date.now() },
  }).catch(() => {});
}

export function subscribeTyping(chatId, meId, cb) {
  return onSnapshot(doc(db, 'chats', chatId), (snap) => {
    const t = snap.data()?.typing || {};
    const active = {};
    for (const [uid, info] of Object.entries(t)) {
      if (uid !== meId && Date.now() - (info.at || 0) < 4000) active[uid] = info.name;
    }
    cb(active);
  });
}

// ---------- STORAGE ----------
export async function uploadFile(file, uid) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `uploads/${uid}/${Date.now()}_${safe}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type || 'application/octet-stream' });
  const url = await getDownloadURL(storageRef);
  return {
    url,
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    isImage: (file.type || '').startsWith('image/'),
  };
}
