import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage, formatPrice } from '../api.ts';
import type { Service, TokenView } from '../api.ts';
import { hairstyleName, isHairstyleKey } from '../hair/styles.ts';
import { KEYS, local } from '../storage.ts';
import { POLL_MS, notificationPermission, sendTurnNotification, shouldAlert } from '../turnAlert.ts';

type Loaded = TokenView | null;

export function Token() {
  const [token, setToken] = useState<Loaded | undefined>(undefined);
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(notificationPermission);

  const storedStyle = local.get(KEYS.style);
  const styleKey = isHairstyleKey(storedStyle) ? storedStyle : null;

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ token: Loaded }>('/api/tokens/mine');
      setToken(r.token);
    } catch (e) {
      // Keep showing the last known token on a failed check; only complain if we have nothing.
      setToken((current) => {
        if (current === undefined) setError(errorMessage(e));
        return current;
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    api<{ services: Service[] }>('/api/services')
      .then((r) => {
        if (cancelled) return;
        setServices(r.services);
        setServiceId((current) => current ?? r.services[0]?.id ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Announce once per token; forget the last announcement when there is no active token.
  useEffect(() => {
    if (token === undefined) return;
    if (token === null) {
      local.remove(KEYS.alerted);
      return;
    }
    const stored = local.get(KEYS.alerted);
    const alerted = stored === null ? null : Number(stored);
    if (shouldAlert(token, alerted)) {
      local.set(KEYS.alerted, String(token.number));
      sendTurnNotification(token);
    }
  }, [token]);

  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const take = () =>
    run(async () => {
      const body = styleKey ? { serviceId, hairstyleKey: styleKey } : { serviceId };
      const r = await api<{ token: TokenView }>('/api/tokens', { method: 'POST', body });
      setToken(r.token);
    });

  const cancel = () =>
    run(async () => {
      await api('/api/tokens/mine', { method: 'DELETE' });
      setToken(null);
    });

  async function askPermission() {
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission('unsupported');
    }
  }

  const alertBox = error && (
    <p role="alert" className="error">
      {error}
    </p>
  );

  if (token === undefined) {
    return (
      <section className="page">
        <h1>Your token</h1>
        {alertBox || <p className="muted">Loading…</p>}
      </section>
    );
  }

  if (token === null) {
    return (
      <section className="page">
        <h1>Take a token</h1>
        <p className="muted">Pick a service and we will hold your place in the queue.</p>
        <div className="card form">
          <label>
            Service
            <select value={serviceId ?? ''} onChange={(e) => setServiceId(Number(e.target.value))}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {services
            .filter((s) => s.id === serviceId)
            .map((s) => (
              <p key={s.id} className="muted small">
                {formatPrice(s.price)} · {s.durationMin} min
              </p>
            ))}
          {styleKey && <p>Style: {hairstyleName(styleKey)}</p>}
          {alertBox}
          <button type="button" className="primary" onClick={take} disabled={busy || serviceId === null}>
            Take token
          </button>
        </div>
      </section>
    );
  }

  const waiting = token.status === 'waiting';

  return (
    <section className="page">
      {token.notifySoon && (
        <p role="status" className="banner">
          Your turn is in about 15 minutes or less — please head over.
        </p>
      )}
      <div className="card ticket">
        <h1>
          Token <span className="number">{token.number}</span>
        </h1>
        <p className="muted">
          {token.serviceName}
          {hairstyleName(token.hairstyleKey) ? ` · ${hairstyleName(token.hairstyleKey)}` : ''}
        </p>
        {waiting ? (
          <>
            <p>{token.aheadCount} ahead of you</p>
            <p>About {token.etaMinutes} min</p>
          </>
        ) : (
          <p>You are being served</p>
        )}
      </div>
      {waiting && permission === 'default' && (
        <button type="button" onClick={askPermission}>
          Alert me on this device
        </button>
      )}
      {waiting && permission === 'denied' && (
        <p className="hint">Notifications are blocked for this site, so keep this page open to see the alert.</p>
      )}
      <p className="hint">The wait is an estimate. This page checks the queue every 15 seconds while it is open.</p>
      {alertBox}
      {waiting && (
        <button type="button" className="danger" onClick={cancel} disabled={busy}>
          Cancel token
        </button>
      )}
    </section>
  );
}
