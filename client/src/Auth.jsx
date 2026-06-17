import React, { useState } from 'react';
import { register, login } from './chatStore.js';
import Logo from './Logo.jsx';

// Firebase xato kodlarini o'zbekcha xabarga aylantirish
function uzError(err) {
  const c = err?.code || '';
  if (c.includes('email-already-in-use')) return 'Bu email allaqachon ro\'yxatdan o\'tgan';
  if (c.includes('invalid-email')) return 'Email noto\'g\'ri';
  if (c.includes('weak-password')) return 'Parol juda zaif (kamida 6 belgi)';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found'))
    return 'Email yoki parol xato';
  if (c.includes('too-many-requests')) return 'Juda ko\'p urinish. Birozdan keyin qayta urining';
  if (c.includes('network')) return 'Internet aloqasi yo\'q';
  return err?.message || 'Xatolik yuz berdi';
}

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await login({ email: email.trim(), password });
      } else {
        await register({ email: email.trim(), password, displayName: displayName.trim() });
      }
      // onAuth listener (App.jsx) holatni avtomatik yangilaydi
    } catch (err) {
      setError(uzError(err));
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
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          placeholder="Parol (kamida 6 belgi)"
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
