import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, errorMessage } from './api.ts';
import type { TokenView } from './api.ts';
import { KEYS, local } from './storage.ts';
import { POLL_MS, sendTurnNotification, shouldAlert } from './turnAlert.ts';

/** undefined = not loaded yet, null = no active token today. */
export type WatchedToken = TokenView | null | undefined;

type TokenWatch = {
  token: WatchedToken;
  /** Why the first load failed, if it did. Later failed checks keep the last known token. */
  loadError: string;
  setToken(token: TokenView | null): void;
};

const TokenWatchContext = createContext<TokenWatch | null>(null);

/**
 * Keeps an eye on the customer's token on every signed-in page, so the 15-minute alert
 * arrives whether they are on the token screen or trying on haircuts.
 */
export function TokenWatchProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<WatchedToken>(undefined);
  const [loadError, setLoadError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ token: TokenView | null }>('/api/tokens/mine');
      setToken(r.token);
      setLoadError('');
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Announce once per token; forget the last announcement when there is no active token.
  useEffect(() => {
    if (token === undefined) return;
    if (token === null) {
      local.remove(KEYS.alerted);
      return;
    }
    const stored = local.get(KEYS.alerted);
    if (shouldAlert(token, stored === null ? null : Number(stored))) {
      local.set(KEYS.alerted, String(token.number));
      sendTurnNotification(token);
    }
  }, [token]);

  const value = useMemo(() => ({ token, loadError, setToken }), [token, loadError]);
  return <TokenWatchContext.Provider value={value}>{children}</TokenWatchContext.Provider>;
}

export function useTokenWatch(): TokenWatch {
  const value = useContext(TokenWatchContext);
  if (!value) throw new Error('useTokenWatch must be used inside TokenWatchProvider');
  return value;
}

export function TurnBanner() {
  const { token } = useTokenWatch();
  if (!token?.notifySoon) return null;
  return (
    <p role="status" className="banner">
      Your turn is in about 15 minutes or less — please head over.
    </p>
  );
}
