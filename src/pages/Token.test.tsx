// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TokenView } from '../api.ts';
import { Token } from './Token.tsx';
import { TokenWatchProvider, TurnBanner } from '../tokenWatch.tsx';
import { renderApp, stubFetch } from '../testkit.tsx';
import type { Call, Reply } from '../testkit.tsx';

const SERVICES = [
  { id: 1, name: 'Haircut', category: 'Hair', price: 300, durationMin: 30 },
  { id: 2, name: 'Beard trim', category: 'Beard', price: 150, durationMin: 15 },
];

const token = (over: Partial<TokenView> = {}): TokenView => ({
  number: 3,
  status: 'waiting',
  serviceName: 'Beard trim',
  hairstyleKey: null,
  aheadCount: 2,
  etaMinutes: 40,
  notifySoon: false,
  ...over,
});

/** A tiny fake of the token API whose current token the test can change. */
function fakeApi(start: TokenView | null, onPost?: (call: Call) => Reply) {
  const state = { mine: start };
  const calls = stubFetch((call) => {
    if (call.url === '/api/services') return { body: { services: SERVICES } };
    if (call.url === '/api/tokens/mine' && call.method === 'GET') return { body: { token: state.mine } };
    if (call.url === '/api/tokens/mine' && call.method === 'DELETE') {
      state.mine = null;
      return { body: { ok: true } };
    }
    if (call.url === '/api/tokens' && call.method === 'POST') {
      if (onPost) return onPost(call);
      state.mine = token();
      return { status: 201, body: { token: state.mine } };
    }
    return { status: 404, body: { error: 'Not found' } };
  });
  return { state, calls };
}

const renderToken = () =>
  renderApp(
    <TokenWatchProvider>
      <TurnBanner />
      <Token />
    </TokenWatchProvider>,
  );

function stubNotification(permission: string) {
  const made = vi.fn();
  const requestPermission = vi.fn(async () => 'granted');
  class FakeNotification {
    static permission = permission;
    static requestPermission = requestPermission;
    constructor(title: string, opts: { body: string }) {
      made(title, opts);
    }
  }
  vi.stubGlobal('Notification', FakeNotification);
  return { made, requestPermission };
}

test('taking a token sends the service and the remembered style', async () => {
  localStorage.setItem('salon.style', 'quiff');
  const { calls } = fakeApi(null);
  renderToken();
  expect(await screen.findByText('Style: Quiff')).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText('Service'), 'Beard trim');
  await userEvent.click(screen.getByRole('button', { name: 'Take token' }));
  expect(await screen.findByRole('heading', { name: 'Token 3' })).toBeTruthy();
  expect(screen.getByText('2 ahead of you')).toBeTruthy();
  expect(screen.getByText('About 40 min')).toBeTruthy();
  const post = calls.find((c) => c.method === 'POST')!;
  expect(post.body).toEqual({ serviceId: 2, hairstyleKey: 'quiff' });
});

test('without a remembered style only the service is sent', async () => {
  const { calls } = fakeApi(null);
  renderToken();
  await userEvent.click(await screen.findByRole('button', { name: 'Take token' }));
  await screen.findByRole('heading', { name: 'Token 3' });
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ serviceId: 1 });
  expect(screen.queryByText(/^Style:/)).toBeNull();
});

test('the banner appears when a later check says the turn is close', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { state } = fakeApi(token({ number: 5 }));
  renderToken();
  await screen.findByRole('heading', { name: 'Token 5' });
  expect(screen.queryByRole('status')).toBeNull();
  state.mine = token({ number: 5, aheadCount: 1, etaMinutes: 15, notifySoon: true });
  await act(() => vi.advanceTimersByTimeAsync(15000));
  expect((await screen.findByRole('status')).textContent).toBe(
    'Your turn is in about 15 minutes or less — please head over.',
  );
  expect(localStorage.getItem('salon.alerted')).toBe('5');
});

test('the banner still appears where notifications are unsupported', async () => {
  vi.stubGlobal('Notification', undefined);
  fakeApi(token({ notifySoon: true, etaMinutes: 10 }));
  renderToken();
  expect(await screen.findByRole('status')).toBeTruthy();
});

test('a notification is sent once, not again after a reload', async () => {
  const first = stubNotification('granted');
  fakeApi(token({ notifySoon: true, etaMinutes: 10 }));
  const view = renderToken();
  await screen.findByRole('status');
  expect(first.made).toHaveBeenCalledTimes(1);
  expect(first.made).toHaveBeenCalledWith('Your turn is close', { body: 'Token 3: about 10 min to go.' });
  view.unmount();
  renderToken();
  await screen.findByRole('status');
  expect(first.made).toHaveBeenCalledTimes(1);
});

test('being served shows no countdown and no banner', async () => {
  fakeApi(token({ status: 'serving', aheadCount: 0, etaMinutes: 0, notifySoon: false }));
  renderToken();
  expect(await screen.findByText('You are being served')).toBeTruthy();
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText(/ahead of you/)).toBeNull();
});

test('the device alert can be switched on while waiting', async () => {
  const n = stubNotification('default');
  fakeApi(token());
  renderToken();
  await userEvent.click(await screen.findByRole('button', { name: 'Alert me on this device' }));
  expect(n.requestPermission).toHaveBeenCalledTimes(1);
});

test('cancelling returns to the service form', async () => {
  const { calls } = fakeApi(token());
  renderToken();
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel token' }));
  expect(await screen.findByRole('button', { name: 'Take token' })).toBeTruthy();
  expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/tokens/mine')).toBe(true);
});

test('a refused token shows the reason', async () => {
  fakeApi(null, () => ({ status: 409, body: { error: 'You already have a token today' } }));
  renderToken();
  await userEvent.click(await screen.findByRole('button', { name: 'Take token' }));
  expect((await screen.findByRole('alert')).textContent).toBe('You already have a token today');
});

test('polling stops when the screen is left', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { calls } = fakeApi(token());
  const view = renderToken();
  await screen.findByRole('heading', { name: 'Token 3' });
  view.unmount();
  const before = calls.length;
  await vi.advanceTimersByTimeAsync(60000);
  await waitFor(() => expect(calls.length).toBe(before));
});
