// @vitest-environment jsdom
import { expect, test } from 'vitest';
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
