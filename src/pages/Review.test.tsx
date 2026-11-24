// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Review as ReviewItem } from '../api.ts';
import { Review } from './Review.tsx';
import { USER, renderApp, stubFetch } from '../testkit.tsx';

function fakeApi(reviews: ReviewItem[], post: { status: number; body: unknown } = { status: 201, body: { ok: true } }) {
  return stubFetch((call) => {
    if (call.url === '/api/auth/me') return { body: { user: USER } };
    if (call.url === '/api/reviews' && call.method === 'POST') return post;
    const count = reviews.length;
    const average = count ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / count) * 10) / 10 : null;
    return { body: { average, count, reviews } };
  });
}

const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  rating: 5,
  comment: 'Great cut',
  name: 'Rafi',
  createdAt: '2026-11-25T10:00:00.000Z',
  ...over,
});

test('works without being signed in, and shows when there are no reviews', async () => {
  fakeApi([]);
  renderApp(<Review />);
  expect(await screen.findByText('No reviews yet')).toBeTruthy();
  expect(localStorage.getItem('salon.session')).toBeNull();
  expect(screen.getByRole('button', { name: 'Send review' })).toBeTruthy();
});

test('send is disabled until a rating is chosen', async () => {
  fakeApi([]);
  renderApp(<Review />);
  const send = screen.getByRole('button', { name: 'Send review' }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
  expect(send.disabled).toBe(false);
  expect(screen.getByRole('button', { name: '4 stars' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: '5 stars' }).getAttribute('aria-pressed')).toBe('false');
});

test('sending a review posts it and says thank you', async () => {
  const calls = fakeApi([]);
  renderApp(<Review />);
  await userEvent.click(screen.getByRole('button', { name: '4 stars' }));
  await userEvent.type(screen.getByLabelText('Comment'), 'Nice');
  await userEvent.click(screen.getByRole('button', { name: 'Send review' }));
  expect(await screen.findByText('Thank you for your review!')).toBeTruthy();
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ rating: 4, comment: 'Nice', name: '' });
  expect(screen.queryByRole('button', { name: 'Send review' })).toBeNull();
});

test('the name is prefilled for a signed-in customer', async () => {
  fakeApi([]);
  renderApp(<Review />, { signedIn: true });
  await waitFor(() => expect((screen.getByLabelText('Your name (optional)') as HTMLInputElement).value).toBe('Rafi'));
});

test('a rejected review shows the reason and keeps the form', async () => {
  fakeApi([], { status: 400, body: { error: 'Comment must be 500 characters or fewer' } });
  renderApp(<Review />);
  await userEvent.click(screen.getByRole('button', { name: '1 star' }));
  await userEvent.click(screen.getByRole('button', { name: 'Send review' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Comment must be 500 characters or fewer');
  expect(screen.getByRole('button', { name: 'Send review' })).toBeTruthy();
});

test('the average and recent reviews are listed', async () => {
  fakeApi([item({ rating: 4, comment: '', name: '' }), item()]);
  renderApp(<Review />);
  expect(await screen.findByText('4.5 out of 5 · 2 reviews')).toBeTruthy();
  expect(screen.getByText('Great cut')).toBeTruthy();
  expect(screen.getByText('Rafi')).toBeTruthy();
  expect(screen.getByText('Guest')).toBeTruthy();
});

test('one review is counted in the singular', async () => {
  fakeApi([item()]);
  renderApp(<Review />);
  expect(await screen.findByText('5 out of 5 · 1 review')).toBeTruthy();
});

test('html in a comment is shown as plain text', async () => {
  fakeApi([item({ comment: '<script>alert(1)</script><b>bold</b>' })]);
  const { container } = renderApp(<Review />);
  expect(await screen.findByText('<script>alert(1)</script><b>bold</b>')).toBeTruthy();
  expect(container.querySelector('.reviews script')).toBeNull();
  expect(container.querySelector('.reviews b')).toBeNull();
});
