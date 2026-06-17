import React, { useState, useEffect } from 'react';

export function Avatar({ name, color, size = 48, online }) {
  const initials = (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="avatar-wrap" style={{ width: size, height: size }}>
      <div className="avatar" style={{ background: color || '#3390ec', width: size, height: size, fontSize: size * 0.4 }}>
        {initials}
      </div>
      {online && <span className="online-dot" />}
    </div>
  );
}

export function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

export function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

// Yangi suhbat / guruh yaratish modali
export function NewChatModal({ onClose, onOpenPrivate, onCreateGroup, searchUsers }) {
  const [tab, setTab] = useState('private');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupTitle, setGroupTitle] = useState('');

  useEffect(() => {
    const t = setTimeout(async () => {
      if (query.trim().length < 1) { setResults([]); return; }
      try { setResults(await searchUsers(query)); } catch {}
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function toggle(u) {
    setSelected((prev) =>
      prev.find((x) => x.id === u.id) ? prev.filter((x) => x.id !== u.id) : [...prev, u]
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{tab === 'private' ? 'Yangi suhbat' : 'Yangi guruh'}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="tabs">
          <button className={tab === 'private' ? 'tab active' : 'tab'} onClick={() => setTab('private')}>Suhbat</button>
          <button className={tab === 'group' ? 'tab active' : 'tab'} onClick={() => setTab('group')}>Guruh</button>
        </div>

        {tab === 'group' && (
          <input
            className="modal-input"
            placeholder="Guruh nomi"
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
          />
        )}

        <input
          className="modal-input"
          placeholder="Foydalanuvchi qidirish..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />

        {tab === 'group' && selected.length > 0 && (
          <div className="chips">
            {selected.map((u) => (
              <span key={u.id} className="chip" onClick={() => toggle(u)}>
                {u.displayName} ✕
              </span>
            ))}
          </div>
        )}

        <div className="search-results">
          {results.map((u) => {
            const isSel = selected.find((x) => x.id === u.id);
            return (
              <div
                key={u.id}
                className="search-row"
                onClick={() => (tab === 'private' ? onOpenPrivate(u) : toggle(u))}
              >
                <Avatar name={u.displayName} color={u.avatarColor} size={40} />
                <div className="search-info">
                  <div className="search-name">{u.displayName}</div>
                  <div className="search-username">@{u.username}</div>
                </div>
                {tab === 'group' && <span className="check">{isSel ? '☑' : '☐'}</span>}
              </div>
            );
          })}
          {query && results.length === 0 && <div className="empty-hint">Hech kim topilmadi</div>}
        </div>

        {tab === 'group' && (
          <button
            className="primary-btn"
            disabled={!groupTitle.trim() || selected.length === 0}
            onClick={() => onCreateGroup(groupTitle, selected.map((u) => u.id))}
          >
            Guruh yaratish ({selected.length})
          </button>
        )}
      </div>
    </div>
  );
}
