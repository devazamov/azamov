import React, { useState } from 'react';
import { api, setToken } from './api.js';
import Logo from './Logo.jsx';

export default function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = mode === 'login'
        ? await api.login({ username, password })
        : await api.register({ username, displayName, password });
      setToken(data.token);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo"><Logo size={96} /></div>
        <h1>AZAMOV</h1>
        <p className="auth-sub">
          {mode === 'login' ? 'Hisobingizga kiring' : 'Yangi hisob yarating'}
        </p>

        <input
          placeholder="Username (foydalanuvchi nomi)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        {mode === 'register' && (
          <input
            placeholder="Ismingiz"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <input
          type="password"
          placeholder="Parol"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="auth-error">{error}</div>}

        <button type="submit" disabled={busy}>
          {busy ? '...' : mode === 'login' ? 'Kirish' : 'Ro\'yxatdan o\'tish'}
        </button>

        <div className="auth-switch">
          {mode === 'login' ? (
            <>Hisobingiz yo'qmi? <a onClick={() => { setMode('register'); setError(''); }}>Ro'yxatdan o'tish</a></>
          ) : (
            <>Hisobingiz bormi? <a onClick={() => { setMode('login'); setError(''); }}>Kirish</a></>
          )}
        </div>
      </form>
    </div>
  );
}
