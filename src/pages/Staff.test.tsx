// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StaffToken } from '../api.ts';
import { Staff } from './Staff.tsx';
import { renderApp, stubFetch } from '../testkit.tsx';

vi.mock('qrcode', () => ({ default: { toDataURL: async () => 'data:image/png;base64,QR' } }));

const A: StaffToken = { number: 1, status: 'waiting', customerName: 'Asha', serviceName: 'Haircut', hairstyleKey: 'quiff' };
const B: StaffToken = { number: 2, status: 'waiting', customerName: 'Bilal', serviceName: 'Beard trim', hairstyleKey: null };

function fakeApi(pin = '1234') {
  const state = { tokens: [A, B] as StaffToken[] };
  const calls = stubFetch((call) => {
    if (call.headers['x-staff-pin'] !== pin) return { status: 401, body: { error: 'Wrong PIN' } };
    if (call.url === '/api/staff/next') {
      state.tokens = state.tokens.filter((t) => t.status !== 'serving');
      const next = state.tokens[0];
      if (next) state.tokens[0] = { ...next, status: 'serving' };
      return { body: { serving: state.tokens[0] ?? null } };
    }
    return { body: { tokens: state.tokens } };
  });
  return { state, calls };
}

async function signIn(pin: string) {
  await userEvent.type(screen.getByLabelText('Staff PIN'), pin);
  await userEvent.click(screen.getByRole('button', { name: 'Open' }));
}

test('the right pin opens the queue', async () => {
  const { calls } = fakeApi();
  renderApp(<Staff />);
  await signIn('1234');
  expect(await screen.findByText('Nobody is being served')).toBeTruthy();
  expect(screen.getByText('Asha')).toBeTruthy();
  expect(screen.getByText('Haircut · Quiff')).toBeTruthy();
  expect(screen.getByText('Beard trim')).toBeTruthy();
  expect(calls[0].headers['x-staff-pin']).toBe('1234');
  expect(sessionStorage.getItem('salon.staffPin')).toBe('1234');
});

test('a wrong pin is refused and not remembered', async () => {
  fakeApi();
  renderApp(<Staff />);
  await signIn('0000');
  expect((await screen.findByRole('alert')).textContent).toBe('Wrong PIN');
  expect(sessionStorage.getItem('salon.staffPin')).toBeNull();
  expect(screen.getByLabelText('Staff PIN')).toBeTruthy();
});

test('call next moves the first waiting customer to the chair', async () => {
  const { calls } = fakeApi();
  renderApp(<Staff />);
  await signIn('1234');
  await userEvent.click(await screen.findByRole('button', { name: 'Call next' }));
  expect(await screen.findByText('Now serving: Token 1 — Asha')).toBeTruthy();
  expect(calls.some((c) => c.url === '/api/staff/next' && c.method === 'POST')).toBe(true);
  expect(screen.getByText('Bilal')).toBeTruthy();
});

test('the review link is shown as a QR code and as text', async () => {
  fakeApi();
  renderApp(<Staff />);
  await signIn('1234');
  const img = (await screen.findByAltText('QR code for the review page')) as HTMLImageElement;
  expect(img.getAttribute('src')).toBe('data:image/png;base64,QR');
  expect(screen.getByText(`${location.origin}/review`)).toBeTruthy();
  expect(screen.getByText('Write this link to an NFC tag to open the same page with a tap.')).toBeTruthy();
});

test('the queue refreshes by itself every 5 seconds', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const { state } = fakeApi();
  sessionStorage.setItem('salon.staffPin', '1234');
  renderApp(<Staff />);
  await screen.findByText('Asha');
  state.tokens = [B];
  await act(() => vi.advanceTimersByTimeAsync(5000));
  expect(screen.queryByText('Asha')).toBeNull();
  expect(screen.getByText('Bilal')).toBeTruthy();
});

test('a pin that stops working sends staff back to the pin form', async () => {
  fakeApi('9999');
  sessionStorage.setItem('salon.staffPin', '1234');
  renderApp(<Staff />);
  expect(await screen.findByLabelText('Staff PIN')).toBeTruthy();
  expect(sessionStorage.getItem('salon.staffPin')).toBeNull();
});
