// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Welcome } from './Welcome.tsx';
import { USER, renderApp, stubFetch } from '../testkit.tsx';

test('the guest form is visible straight away', () => {
  stubFetch(() => ({}));
  renderApp(<Welcome />);
  expect(screen.getByLabelText('Your name')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Continue as guest' })).toBeTruthy();
});

test('continuing as a guest stores the session', async () => {
  const calls = stubFetch(() => ({ status: 201, body: { token: 'tok', user: USER } }));
  renderApp(<Welcome />);
  await userEvent.type(screen.getByLabelText('Your name'), 'Rafi');
  await userEvent.click(screen.getByRole('button', { name: 'Continue as guest' }));
  await waitFor(() => expect(localStorage.getItem('salon.session')).toBe('tok'));
  expect(calls[0]).toMatchObject({ url: '/api/auth/guest', method: 'POST', body: { name: 'Rafi' } });
});

test('a rejected name shows the message and stores nothing', async () => {
  stubFetch(() => ({ status: 400, body: { error: 'Please enter a name of 1 to 40 characters' } }));
  renderApp(<Welcome />);
  await userEvent.type(screen.getByLabelText('Your name'), 'x');
  await userEvent.click(screen.getByRole('button', { name: 'Continue as guest' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Please enter a name of 1 to 40 characters');
  expect(localStorage.getItem('salon.session')).toBeNull();
});

test('logging in posts phone and password', async () => {
  const calls = stubFetch(() => ({ body: { token: 'tok2', user: { ...USER, isGuest: false, phone: '01712345678' } } }));
  renderApp(<Welcome />);
  await userEvent.click(screen.getByRole('tab', { name: 'Log in' }));
  await userEvent.type(screen.getByLabelText('Phone'), '01712345678');
  await userEvent.type(screen.getByLabelText('Password'), 'secret1');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
  await waitFor(() => expect(localStorage.getItem('salon.session')).toBe('tok2'));
  expect(calls[0]).toMatchObject({ url: '/api/auth/login', body: { phone: '01712345678', password: 'secret1' } });
});

test('creating an account posts name, phone and password', async () => {
  const calls = stubFetch(() => ({ status: 201, body: { token: 'tok3', user: USER } }));
  renderApp(<Welcome />);
  await userEvent.click(screen.getByRole('tab', { name: 'Create account' }));
  await userEvent.type(screen.getByLabelText('Name'), 'Mina');
  await userEvent.type(screen.getByLabelText('Phone'), '01712345678');
  await userEvent.type(screen.getByLabelText('Password'), 'secret1');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => expect(localStorage.getItem('salon.session')).toBe('tok3'));
  expect(calls[0]).toMatchObject({ url: '/api/auth/register', body: { name: 'Mina', phone: '01712345678', password: 'secret1' } });
});
