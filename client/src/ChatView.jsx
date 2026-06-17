import React, { useState, useRef, useEffect } from 'react';
import { api, fileUrl } from './api.js';
import { Avatar, formatTime, formatBytes } from './components.jsx';

export default function ChatView({ chat, me, messages, onSend, onTyping, typingUsers, online }) {
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [chat.id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function submit(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    onSend({ body });
    setText('');
  }

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const attachment = await api.upload(file);
      onSend({ body: '', attachId: attachment.id, attachment });
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  }

  const subtitle = chat.type === 'group'
    ? `${chat.members.length} a'zo`
    : online ? 'onlayn' : 'oxirgi marta yaqinda';

  const typingNames = Object.values(typingUsers || {});

  return (
    <div className="chat-view">
      <header className="chat-header">
        <Avatar name={chat.title} color={chat.avatarColor} size={42} online={chat.type === 'private' && online} />
        <div className="chat-header-info">
          <div className="chat-header-title">{chat.title}</div>
          <div className="chat-header-sub">
            {typingNames.length > 0 ? <span className="typing">yozmoqda...</span> : subtitle}
          </div>
        </div>
      </header>

      <div className="messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="no-messages">Hali xabar yo'q. Birinchi bo'lib yozing!</div>
        )}
        {messages.map((m, i) => {
          const mine = m.senderId === me.id;
          const prev = messages[i - 1];
          const showName = chat.type === 'group' && !mine && (!prev || prev.senderId !== m.senderId);
          return <MessageBubble key={m.id || m.tempId} m={m} mine={mine} showName={showName} />;
        })}
        <div ref={bottomRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <button type="button" className="icon-btn attach" onClick={() => fileRef.current?.click()} title="Fayl biriktirish">
          {uploading ? '⏳' : '📎'}
        </button>
        <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={pickFile} />
        <input
          className="composer-input"
          placeholder="Xabar yozing..."
          value={text}
          onChange={(e) => { setText(e.target.value); onTyping(); }}
        />
        <button type="submit" className="send-btn" disabled={!text.trim()}>➤</button>
      </form>
    </div>
  );
}

function MessageBubble({ m, mine, showName }) {
  return (
    <div className={mine ? 'msg-row mine' : 'msg-row'}>
      <div className="bubble" style={!mine && showName ? { borderTopLeftRadius: 4 } : undefined}>
        {showName && <div className="bubble-name" style={{ color: m.senderColor }}>{m.senderName}</div>}
        {m.attachment && <Attachment a={m.attachment} />}
        {m.body && <div className="bubble-text">{m.body}</div>}
        <span className="bubble-time">{formatTime(m.createdAt)}{mine && <span className="ticks"> ✓✓</span>}</span>
      </div>
    </div>
  );
}

function Attachment({ a }) {
  if (a.isImage) {
    return (
      <a href={fileUrl(a.url)} target="_blank" rel="noreferrer" className="attach-image">
        <img src={fileUrl(a.url)} alt={a.name} />
      </a>
    );
  }
  return (
    <a href={fileUrl(a.url)} target="_blank" rel="noreferrer" download={a.name} className="attach-file">
      <span className="attach-icon">📄</span>
      <span className="attach-meta">
        <span className="attach-name">{a.name}</span>
        <span className="attach-size">{formatBytes(a.size)}</span>
      </span>
    </a>
  );
}
