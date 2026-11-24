import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { SALON_NAME } from '../App.tsx';
import { errorMessage } from '../api.ts';
import { OfflineNotice, useSession } from '../session.tsx';

type Mode = 'guest' | 'login' | 'register';

const TABS: { mode: Mode; label: string }[] = [
  { mode: 'guest', label: 'Guest' },
  { mode: 'login', label: 'Log in' },
  { mode: 'register', label: 'Create account' },
];

export function Welcome() {
  const { user, loading, offline, continueAsGuest, login, register } = useSession();
  const [mode, setMode] = useState<Mode>('guest');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/styles" replace />;
  if (loading) return <p className="center muted">Loading…</p>;
  if (offline) return <OfflineNotice />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'guest') await continueAsGuest(name);
      else if (mode === 'login') await login(phone, password);
      else await register(name, phone, password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const submitLabel = mode === 'guest' ? 'Continue as guest' : mode === 'login' ? 'Log in' : 'Create account';

  return (
    <div className="welcome">
      <div className="pole" aria-hidden="true" />
      <h1 className="display">{SALON_NAME}</h1>
      <p className="muted">Try a haircut on, take your place in the queue.</p>

      <div className="tabs" role="tablist" aria-label="How to enter">
        {TABS.map((t) => (
          <button
            key={t.mode}
            type="button"
            role="tab"
            aria-selected={mode === t.mode}
            onClick={() => {
              setMode(t.mode);
              setError('');
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form className="card form" onSubmit={submit}>
        {mode !== 'login' && (
          <label>
            {mode === 'guest' ? 'Your name' : 'Name'}
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" required />
          </label>
        )}
        {mode !== 'guest' && (
          <>
            <label>
              Phone
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
              />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy}>
          {submitLabel}
        </button>
        {mode === 'guest' && <p className="hint">No account needed. You can still take a token and leave a review.</p>}
      </form>
    </div>
  );
}
