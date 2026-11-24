import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, api } from './api.ts';
import type { User } from './api.ts';
import { KEYS, local } from './storage.ts';

type AuthReply = { token: string; user: User };

type SessionValue = {
  user: User | null;
  loading: boolean;
  /** A session is stored but the salon could not be reached to check it. */
  offline: boolean;
  retry(): void;
  continueAsGuest(name: string): Promise<void>;
  login(phone: string, password: string): Promise<void>;
  register(name: string, phone: string, password: string): Promise<void>;
  signOut(): void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => local.get(KEYS.session) !== null);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!local.get(KEYS.session)) return;
    let cancelled = false;
    setLoading(true);
    api<{ user: User }>('/api/auth/me')
      .then((r) => {
        if (cancelled) return;
        setUser(r.user);
        setOffline(false);
      })
      .catch((e) => {
        if (cancelled) return;
        // Only a rejected session is forgotten. Anything else (no signal, server restarting) keeps it:
        // dropping it would strand the customer's token in the queue under a session nobody holds.
        if (e instanceof ApiError && e.status === 401) {
          local.remove(KEYS.session);
          setOffline(false);
        } else {
          setOffline(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const start = useCallback((reply: AuthReply) => {
    local.set(KEYS.session, reply.token);
    setUser(reply.user);
    setOffline(false);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      offline,
      retry() {
        setAttempt((n) => n + 1);
      },
      async continueAsGuest(name) {
        start(await api<AuthReply>('/api/auth/guest', { method: 'POST', body: { name } }));
      },
      async login(phone, password) {
        start(await api<AuthReply>('/api/auth/login', { method: 'POST', body: { phone, password } }));
      },
      async register(name, phone, password) {
        start(await api<AuthReply>('/api/auth/register', { method: 'POST', body: { name, phone, password } }));
      },
      signOut() {
        local.remove(KEYS.session);
        local.remove(KEYS.alerted);
        setUser(null);
        setOffline(false);
      },
    }),
    [user, loading, offline, start],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** Shown instead of the sign-in form when a stored session could not be checked. */
export function OfflineNotice() {
  const { retry, signOut } = useSession();
  return (
    <section className="page">
      <h1>Could not reach the salon.</h1>
      <p className="muted">Check your connection. Your place in the queue is safe.</p>
      <button type="button" className="primary" onClick={retry}>
        Try again
      </button>
      <button type="button" className="link" onClick={signOut}>
        Sign out and start again
      </button>
    </section>
  );
}
