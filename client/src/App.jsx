import React, { useState, useEffect, useRef } from 'react';
import {
  onAuth, logout, startPresence,
  subscribeChats, subscribeMessages, subscribeTyping,
  sendMessage as sendMsg, setTyping, uploadFile,
  openPrivateChat, createGroup as createGroupFb,
  searchUsers, isUserOnline, subscribeUser,
} from './chatStore.js';
import { db } from './firebase.js';
import { doc, onSnapshot } from 'firebase/firestore';
import Auth from './Auth.jsx';
import ChatView from './ChatView.jsx';
import { Avatar, formatTime, NewChatModal } from './components.jsx';
import Logo from './Logo.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuth((u) => { setUser(u); setLoading(false); });
    return unsub;
  }, []);

  if (loading) return <div className="splash"><Logo size={72} /><p>Yuklanmoqda...</p></div>;
  if (!user) return <Auth />;
  return <Messenger user={user} onLogout={logout} />;
}

function Messenger({ user, onLogout }) {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typing, setTypingState] = useState({});
  const [onlineMap, setOnlineMap] = useState({}); // uid -> bool
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const active = chats.find((c) => c.id === activeId) || null;

  // Presence — o'zimizni "online" ushlab turamiz
  useEffect(() => startPresence(user.id), [user.id]);

  // Chatlar ro'yxati (realtime)
  useEffect(() => subscribeChats(user.id, setChats), [user.id]);

  // Faol chat xabarlari (realtime)
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setMessages([]);
    const unsub = subscribeMessages(activeId, setMessages);
    return unsub;
  }, [activeId]);

  // Faol chatda typing holatini kuzatish
  useEffect(() => {
    if (!activeId) return;
    return subscribeTyping(activeId, user.id, (t) => setTypingState(t));
  }, [activeId, user.id]);

  // Suhbatdoshlarning online holatini kuzatish
  const peerIds = chats.filter((c) => c.peer).map((c) => c.peer.id).join(',');
  useEffect(() => {
    const ids = peerIds ? peerIds.split(',') : [];
    const unsubs = ids.map((uid) =>
      subscribeUser(uid, (data) => {
        setOnlineMap((prev) => ({ ...prev, [uid]: isUserOnline(data) }));
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [peerIds]);

  async function handleSend({ body }) {
    if (!activeId) return;
    await sendMsg(activeId, user, { body });
  }

  async function handleFile(file) {
    if (!activeId || !file) return;
    setUploading(true);
    try {
      const attachment = await uploadFile(file, user.id);
      await sendMsg(activeId, user, { body: '', attachment });
    } catch (err) {
      alert('Yuklashda xato: ' + (err.message || err));
    } finally {
      setUploading(false);
    }
  }

  const lastTyping = useRef(0);
  function notifyTyping() {
    const now = Date.now();
    if (now - lastTyping.current > 2500) {
      lastTyping.current = now;
      if (activeId) setTyping(activeId, user);
    }
  }

  async function openPrivate(u) {
    const chatId = await openPrivateChat(user, u);
    setActiveId(chatId);
    setShowNew(false);
  }

  async function createGroup(title, members) {
    const chatId = await createGroupFb(user, title, members);
    setActiveId(chatId);
    setShowNew(false);
  }

  const isOnline = (chat) => chat.peer ? !!onlineMap[chat.peer.id] : false;
  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="messenger">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={28} />
          <span className="brand-name">AZAMOV</span>
        </div>

        <div className="sidebar-header">
          <Avatar name={user.displayName} color={user.avatarColor} size={40} />
          <div className="sidebar-me">
            <div className="sidebar-name">{user.displayName}</div>
            <div className="sidebar-status online">● onlayn</div>
          </div>
          <button className="icon-btn" title="Chiqish" onClick={onLogout}>⎋</button>
        </div>

        <div className="search-bar">
          <input
            placeholder="Qidirish..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="chat-list">
          {filteredChats.length === 0 && (
            <div className="empty-hint">Suhbatlar yo'q. Yangi suhbat boshlang.</div>
          )}
          {filteredChats.map((c) => (
            <div
              key={c.id}
              className={c.id === activeId ? 'chat-item active' : 'chat-item'}
              onClick={() => setActiveId(c.id)}
            >
              <Avatar name={c.title} color={c.avatarColor} size={52} online={isOnline(c)} />
              <div className="chat-item-body">
                <div className="chat-item-top">
                  <span className="chat-item-title">{c.title}</span>
                  {c.lastMessage && <span className="chat-item-time">{formatTime(c.lastMessage.createdAt)}</span>}
                </div>
                <div className="chat-item-last">
                  {c.lastMessage ? (
                    <>
                      {c.type === 'group' && c.lastMessage.senderName ? `${c.lastMessage.senderName.split(' ')[0]}: ` : ''}
                      {c.lastMessage.attachment ? (c.lastMessage.attachment.isImage ? '🖼 Rasm' : '📄 Fayl') : c.lastMessage.body}
                    </>
                  ) : (
                    <span className="muted">Xabar yo'q</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="fab" onClick={() => setShowNew(true)} title="Yangi suhbat">✎</button>
      </aside>

      <main className="main-pane">
        {active ? (
          <ChatView
            chat={active}
            me={user}
            messages={messages}
            onSend={handleSend}
            onFile={handleFile}
            onTyping={notifyTyping}
            typingUsers={typing}
            online={isOnline(active)}
            uploading={uploading}
          />
        ) : (
          <div className="welcome">
            <div className="welcome-icon"><Logo size={104} /></div>
            <h2>AZAMOV</h2>
            <p>Suhbatni tanlang yoki yangi suhbat boshlang</p>
          </div>
        )}
      </main>

      {showNew && (
        <NewChatModal
          onClose={() => setShowNew(false)}
          onOpenPrivate={openPrivate}
          onCreateGroup={createGroup}
          searchUsers={(q) => searchUsers(q, user.id)}
        />
      )}
    </div>
  );
}
