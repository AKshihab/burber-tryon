// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { ApiError, api, formatPrice } from './api.ts';
import { stubFetch } from './testkit.tsx';

test('formatPrice puts the currency sign first', () => {
  expect(formatPrice(300)).toBe('৳300');
});

test('sends the bearer header only when a session is stored', async () => {
  const calls = stubFetch(() => ({ body: { ok: true } }));
  await api('/api/health');
  expect(calls[0].headers.Authorization).toBeUndefined();
  localStorage.setItem('salon.session', 'abc');
  await api('/api/health');
  expect(calls[1].headers.Authorization).toBe('Bearer abc');
});

test('json-encodes the body', async () => {
  const calls = stubFetch(() => ({ body: {} }));
  await api('/api/reviews', { method: 'POST', body: { rating: 5 } });
  expect(calls[0]).toMatchObject({ method: 'POST', body: { rating: 5 } });
  expect(calls[0].headers['Content-Type']).toBe('application/json');
});

test('a server error message becomes an ApiError', async () => {
  stubFetch(() => ({ status: 409, body: { error: 'Phone already registered' } }));
  const err = (await api('/api/auth/register', { method: 'POST', body: {} }).catch((e) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(409);
  expect(err.message).toBe('Phone already registered');
});

test('a non-JSON error body gets a generic message', async () => {
  stubFetch(() => ({ status: 502, text: '<html>bad gateway</html>' }));
  const err = (await api('/api/health').catch((e) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.message).toBe('Something went wrong');
});

test('a network failure becomes an ApiError with status 0', async () => {
  vi.stubGlobal('fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  const err = (await api('/api/health').catch((e) => e)) as ApiError;
  expect(err).toBeInstanceOf(ApiError);
  expect(err.status).toBe(0);
});
