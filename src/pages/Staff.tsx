import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import QRCode from 'qrcode';
import { SALON_NAME } from '../App.tsx';
import { ApiError, api, errorMessage } from '../api.ts';
import type { StaffToken } from '../api.ts';
import { hairstyleName } from '../hair/styles.ts';
import { KEYS, session } from '../storage.ts';

const REFRESH_MS = 5000;

function ReviewLink() {
  const url = `${location.origin}/review`;
  const [qr, setQr] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, { width: 400, margin: 1 })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        /* the link below still works */
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="group">
      <h2>Review link</h2>
      <div className="card form">
        {qr && <img className="qr" src={qr} alt="QR code for the review page" />}
        <p className="url">{url}</p>
        <p className="hint">Write this link to an NFC tag to open the same page with a tap.</p>
      </div>
    </div>
  );
}

export function Staff() {
  const [pin, setPin] = useState(() => session.get(KEYS.staffPin) ?? '');
  const [draft, setDraft] = useState('');
  const [tokens, setTokens] = useState<StaffToken[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lock = useCallback((message: string) => {
    session.remove(KEYS.staffPin);
    setPin('');
    setTokens(null);
    setError(message);
  }, []);

  const load = useCallback(
    async (withPin: string) => {
      try {
        const r = await api<{ tokens: StaffToken[] }>('/api/staff/queue', { headers: { 'x-staff-pin': withPin } });
        session.set(KEYS.staffPin, withPin);
        setTokens(r.tokens);
        setError('');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) lock('Wrong PIN');
        else setError(errorMessage(e));
      }
    },
    [lock],
  );

  useEffect(() => {
    if (!pin) return;
    void load(pin);
    const timer = setInterval(() => void load(pin), REFRESH_MS);
    return () => clearInterval(timer);
  }, [pin, load]);

  function open(e: FormEvent) {
    e.preventDefault();
    setError('');
    setPin(draft.trim());
    setDraft('');
  }

  async function callNext() {
    setBusy(true);
    try {
      await api('/api/staff/next', { method: 'POST', headers: { 'x-staff-pin': pin } });
      await load(pin);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) lock('Wrong PIN');
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const alertBox = error && (
    <p role="alert" className="error">
      {error}
    </p>
  );

  if (!pin) {
    return (
      <section className="page">
        <p className="brand">{SALON_NAME}</p>
        <h1>Staff</h1>
        <form className="card form" onSubmit={open}>
          <label>
            Staff PIN
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
            />
          </label>
          {alertBox}
          <button type="submit" className="primary">
            Open
          </button>
        </form>
      </section>
    );
  }

  const serving = tokens?.find((t) => t.status === 'serving');
  const waiting = tokens?.filter((t) => t.status === 'waiting') ?? [];

  return (
    <section className="page">
      <p className="brand">{SALON_NAME}</p>
      <h1>Queue</h1>
      {alertBox}
      {!tokens && !error && <p className="muted">Loading…</p>}
      {tokens && (
        <>
          <div className="card form">
            <p className="status">
              {serving ? `Now serving: Token ${serving.number} — ${serving.customerName}` : 'Nobody is being served'}
            </p>
            {serving && (
              <p className="muted small" style={{ textAlign: 'center', margin: 0 }}>
                {[serving.serviceName, hairstyleName(serving.hairstyleKey)].filter(Boolean).join(' · ')}
              </p>
            )}
            <button type="button" className="primary" onClick={callNext} disabled={busy || (!serving && waiting.length === 0)}>
              Call next
            </button>
          </div>

          <div className="group">
            <h2>Waiting ({waiting.length})</h2>
            {waiting.length === 0 ? (
              <p className="muted">Nobody is waiting.</p>
            ) : (
              <ul className="list">
                {waiting.map((t) => (
                  <li key={t.number} className="row">
                    <span className="row-main">
                      <span className="row-title">{t.customerName}</span>
                      <span className="muted small">
                        {[t.serviceName, hairstyleName(t.hairstyleKey)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="price">{t.number}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <ReviewLink />
      <button type="button" className="link" onClick={() => lock('')}>
        Lock this screen
      </button>
    </section>
  );
}
