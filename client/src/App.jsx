import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, setToken, getToken, connectSocket } from './api.js';
import Auth from './Auth.jsx';
import ChatView from './ChatView.jsx';
import { Avatar, formatTime, NewChatModal } from './components.jsx';
import Logo from './Logo.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    api.me().then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="splash">Yuklanmoqda...</div>;
  if (!user) return <Auth onAuth={setUser} />;
  return <Messenger user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}

function Messenger({ user, onLogout }) {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messagesByChat, setMessagesByChat] = useState({});
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typing, setTyping] = useState({}); // chatId -> {userId: name}
  const [wsStatus, setWsStatus] = useState('offline');
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');

  const sockRef = useRef(null);
  const activeIdRef = useRef(null);
  const typingTimers = useRef({});
  activeIdRef.current = activeId;

  const active = chats.find((c) => c.id === activeId) || null;

  // Dastlabki yuklash
  useEffect(() => {
    api.chats().then((d) => setChats(d.chats)).catch(() => {});
  }, []);

  // WebSocket hodisalari
  const handleEvent = useCallback((type, payload) => {
    if (type === 'message') {
      const msg = payload;
      setMessagesByChat((prev) => {
        const list = prev[msg.chatId] ? [...prev[msg.chatId]] : [];
        // tempId bo'yicha optimistik xabarni almashtirish
        const idx = msg.tempId ? list.findIndex((m) => m.tempId === msg.tempId) : -1;
        if (idx >= 0) list[idx] = msg;
        else if (!list.find((m) => m.id === msg.id)) list.push(msg);
        return { ...prev, [msg.chatId]: list };
      });
      // Chat ro'yxatida oxirgi xabar va tartibni yangilash
      setChats((prev) => {
        let found = false;
        const next = prev.map((c) => {
          if (c.id === msg.chatId) { found = true; return { ...c, lastMessage: msg }; }
          return c;
        });
        if (!found) { api.chats().then((d) => setChats(d.chats)); return prev; }
        next.sort((a, b) => (b.lastMessage?.createdAt || b.createdAt) - (a.lastMessage?.createdAt || a.createdAt));
        return next;
      });
    } else if (type === 'chat_created') {
      setChats((prev) => prev.find((c) => c.id === payload.chat.id) ? prev : [payload.chat, ...prev]);
    } else if (type === 'presence') {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (payload.online) next.add(payload.userId); else next.delete(payload.userId);
        return next;
      });
    } else if (type === 'typing') {
      const { chatId, userId, name } = payload;
      setTyping((prev) => ({ ...prev, [chatId]: { ...(prev[chatId] || {}), [userId]: name } }));
      const key = `${chatId}:${userId}`;
      clearTimeout(typingTimers.current[key]);
      typingTimers.current[key] = setTimeout(() => {
        setTyping((prev) => {
          const c = { ...(prev[chatId] || {}) };
          delete c[userId];
          return { ...prev, [chatId]: c };
        });
      }, 3000);
    }
  }, []);

  useEffect(() => {
    sockRef.current = connectSocket(handleEvent, setWsStatus);
    return () => sockRef.current?.close();
  }, [handleEvent]);

  // Faol chat ochilganda tarixni yuklash
  useEffect(() => {
    if (activeId == null || messagesByChat[activeId]) return;
    api.messages(activeId).then((d) =>
      setMessagesByChat((prev) => ({ ...prev, [activeId]: d.messages }))
    ).catch(() => {});
  }, [activeId]);

  function sendMessage({ body, attachId, attachment }) {
    const tempId = 't' + Math.random().toString(36).slice(2);
    const optimistic = {
      tempId, id: null, chatId: activeId, senderId: user.id,
      senderName: user.displayName, senderColor: user.avatarColor,
      body, attachment: attachment || null, createdAt: Date.now(),
    };
    setMessagesByChat((prev) => ({
      ...prev, [activeId]: [...(prev[activeId] || []), optimistic],
    }));
    sockRef.current?.send('message', { chatId: activeId, body, attachId, tempId });
  }

  const lastTypingSent = useRef(0);
  function notifyTyping() {
    const now = Date.now();
    if (now - lastTypingSent.current > 2000) {
      lastTypingSent.current = now;
      sockRef.current?.send('typing', { chatId: activeId });
    }
  }

  async function openPrivate(u) {
    const d = await api.openPrivate(u.id);
    setChats((prev) => prev.find((c) => c.id === d.chat.id) ? prev : [d.chat, ...prev]);
    setActiveId(d.chat.id);
    setShowNew(false);
  }

  async function createGroup(title, memberIds) {
    const d = await api.createGroup(title, memberIds);
    setChats((prev) => [d.chat, ...prev]);
    setActiveId(d.chat.id);
    setShowNew(false);
  }

  const isOnline = (chat) => chat.peer ? onlineUsers.has(chat.peer.id) : false;

  const filteredChats = chats.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

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
            <div className={`sidebar-status ${wsStatus}`}>
              {wsStatus === 'online' ? '● ulangan' : '○ ulanmoqda...'}
            </div>
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
                  {typing[c.id] && Object.keys(typing[c.id]).length > 0 ? (
                    <span className="typing">yozmoqda...</span>
                  ) : c.lastMessage ? (
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
            messages={messagesByChat[active.id] || []}
            onSend={sendMessage}
            onTyping={notifyTyping}
            typingUsers={typing[active.id]}
            online={isOnline(active)}
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
        />
      )}
    </div>
  );
}
