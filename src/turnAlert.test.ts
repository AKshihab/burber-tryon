// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import type { TokenView } from './api.ts';
import './testkit.tsx';
import { POLL_MS, sendTurnNotification, shouldAlert } from './turnAlert.ts';

const token = (over: Partial<TokenView> = {}): TokenView => ({
  number: 7,
  status: 'waiting',
  serviceName: 'Haircut',
  hairstyleKey: null,
  aheadCount: 1,
  etaMinutes: 12,
  notifySoon: true,
  ...over,
});

function stubNotification(permission: string, construct: (title: string, opts: { body: string }) => void) {
  class FakeNotification {
    static permission = permission;
    constructor(title: string, opts: { body: string }) {
      construct(title, opts);
    }
  }
  vi.stubGlobal('Notification', FakeNotification);
}

test('polls every 15 seconds', () => expect(POLL_MS).toBe(15000));

test('shouldAlert', () => {
  expect(shouldAlert(null, null)).toBe(false);
  expect(shouldAlert(token({ notifySoon: false }), null)).toBe(false);
  expect(shouldAlert(token(), null)).toBe(true);
  expect(shouldAlert(token(), 7)).toBe(false);
  expect(shouldAlert(token(), 6)).toBe(true);
});

test('sends a notification when permission is granted', () => {
  const made = vi.fn();
  stubNotification('granted', made);
  sendTurnNotification(token());
  expect(made).toHaveBeenCalledWith('Your turn is close', { body: 'Token 7: about 12 min to go.' });
});

test('stays quiet when permission is denied', () => {
  const made = vi.fn();
  stubNotification('denied', made);
  sendTurnNotification(token());
  expect(made).not.toHaveBeenCalled();
});

test('does not throw when notifications are unsupported', () => {
  vi.stubGlobal('Notification', undefined);
  expect(() => sendTurnNotification(token())).not.toThrow();
});

test('does not throw when the browser refuses to build one', () => {
  stubNotification('granted', () => {
    throw new TypeError('Illegal constructor');
  });
  expect(() => sendTurnNotification(token())).not.toThrow();
});

test('falls back to the service worker where pages may not build notifications (Android)', async () => {
  stubNotification('granted', () => {
    throw new TypeError('Illegal constructor');
  });
  const showNotification = vi.fn();
  vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ showNotification }) } });
  sendTurnNotification(token());
  await vi.waitFor(() =>
    expect(showNotification).toHaveBeenCalledWith('Your turn is close', { body: 'Token 7: about 12 min to go.' }),
  );
});
