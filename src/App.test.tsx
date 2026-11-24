// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRoutes } from './App.tsx';
import { USER, renderApp, stubFetch } from './testkit.tsx';

test('a signed-out visitor to a customer page lands on the welcome screen', async () => {
  stubFetch(() => ({}));
  renderApp(<AppRoutes />, { path: '/catalog' });
  expect(await screen.findByRole('button', { name: 'Continue as guest' })).toBeTruthy();
});

test('a signed-in visitor sees the navigation and can sign out', async () => {
  stubFetch((c) => (c.url === '/api/auth/me' ? { body: { user: USER } } : { body: { services: [] } }));
  renderApp(<AppRoutes />, { path: '/catalog', signedIn: true });
  expect(await screen.findByRole('link', { name: 'Catalog' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Token' })).toBeTruthy();
  expect(screen.getByText('Rafi')).toBeTruthy();
  await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Continue as guest' })).toBeTruthy();
  expect(localStorage.getItem('salon.session')).toBeNull();
});

test('an expired session is cleared', async () => {
  stubFetch(() => ({ status: 401, body: { error: 'Please sign in' } }));
  renderApp(<AppRoutes />, { path: '/catalog', signedIn: true });
  expect(await screen.findByRole('button', { name: 'Continue as guest' })).toBeTruthy();
  expect(localStorage.getItem('salon.session')).toBeNull();
});

test('a network failure on load keeps the session and offers a retry instead of the sign-in form', async () => {
  let online = false;
  vi.stubGlobal('fetch', async (url: string) => {
    if (!online) throw new TypeError('Failed to fetch');
    const body = url === '/api/auth/me' ? { user: USER } : url === '/api/tokens/mine' ? { token: null } : { services: [] };
    return new Response(JSON.stringify(body));
  });
  renderApp(<AppRoutes />, { path: '/catalog', signedIn: true });
  expect(await screen.findByText('Could not reach the salon.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Continue as guest' })).toBeNull();
  expect(localStorage.getItem('salon.session')).toBe('tok');
  online = true;
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('link', { name: 'Catalog' })).toBeTruthy();
  expect(screen.getByText('Rafi')).toBeTruthy();
});

test('the welcome screen does not offer a new guest session while a stored one cannot be checked', async () => {
  vi.stubGlobal('fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  renderApp(<AppRoutes />, { path: '/', signedIn: true });
  expect(await screen.findByText('Could not reach the salon.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Continue as guest' })).toBeNull();
});

test('the turn alert shows on other customer pages, not only the token page', async () => {
  const token = { number: 4, status: 'waiting', serviceName: 'Haircut', hairstyleKey: null, aheadCount: 0, etaMinutes: 10, notifySoon: true };
  stubFetch((c) =>
    c.url === '/api/auth/me' ? { body: { user: USER } } : c.url === '/api/tokens/mine' ? { body: { token } } : { body: { services: [] } },
  );
  renderApp(<AppRoutes />, { path: '/catalog', signedIn: true });
  expect((await screen.findByRole('status')).textContent).toBe('Your turn is in about 15 minutes or less — please head over.');
  expect(screen.getByRole('heading', { name: 'Catalog' })).toBeTruthy();
});
