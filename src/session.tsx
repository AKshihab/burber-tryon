import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, api } from './api.ts';
import type { User } from './api.ts';
import { KEYS, local } from './storage.ts';

type AuthReply = { token: string; user: User };

type SessionValue = {
  user: User | null;
  loading: boolean;
  continueAsGuest(name: string): Promise<void>;
  login(phone: string, password: string): Promise<void>;
  register(name: string, phone: string, password: string): Promise<void>;
  signOut(): void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => local.get(KEYS.session) !== null);

  useEffect(() => {
    if (!local.get(KEYS.session)) return;
    let cancelled = false;
    api<{ user: User }>('/api/auth/me')
      .then((r) => {
        if (!cancelled) setUser(r.user);
      })
      .catch((e) => {
        // Only a rejected session is forgotten; a network blip keeps it for the next load.
        if (e instanceof ApiError && e.status === 401) local.remove(KEYS.session);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const start = useCallback((reply: AuthReply) => {
    local.set(KEYS.session, reply.token);
    setUser(reply.user);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
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
      },
    }),
    [user, loading, start],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
