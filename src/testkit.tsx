import { afterEach, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider } from './session.tsx';

export type Call = { url: string; method: string; body: unknown; headers: Record<string, string> };
export type Reply = { status?: number; body?: unknown; text?: string };

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/** Replace fetch with a handler; returns the list of calls made so far. */
export function stubFetch(handler: (call: Call) => Reply): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    const call: Call = {
      url,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      headers: (init.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    const reply = handler(call);
    const status = reply.status ?? 200;
    const text = reply.text ?? JSON.stringify(reply.body ?? {});
    return new Response(text, { status });
  });
  return calls;
}

export const USER = { id: 1, name: 'Rafi', phone: null, isGuest: true };

/** Render inside a router and session. `signedIn` stores a session token first. */
export function renderApp(ui: ReactElement, opts: { path?: string; signedIn?: boolean } = {}) {
  if (opts.signedIn) localStorage.setItem('salon.session', 'tok');
  return render(
    <MemoryRouter initialEntries={[opts.path ?? '/']}>
      <SessionProvider>{ui}</SessionProvider>
    </MemoryRouter>,
  );
}
