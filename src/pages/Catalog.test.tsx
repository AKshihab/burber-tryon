// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { Catalog } from './Catalog.tsx';
import { renderApp, stubFetch } from '../testkit.tsx';

const SERVICES = [
  { id: 1, name: 'Haircut', category: 'Hair', price: 300, durationMin: 30 },
  { id: 2, name: 'Beard trim', category: 'Beard', price: 150, durationMin: 15 },
  { id: 3, name: 'Haircut + beard', category: 'Hair', price: 400, durationMin: 40 },
  { id: 4, name: 'Hair wash & style', category: 'Care', price: 250, durationMin: 20 },
  { id: 5, name: 'Hair colour', category: 'Hair', price: 1200, durationMin: 60 },
  { id: 6, name: 'Head massage', category: 'Care', price: 200, durationMin: 15 },
];

test('services are grouped by category with price and duration', async () => {
  stubFetch(() => ({ body: { services: SERVICES } }));
  renderApp(<Catalog />);
  expect(await screen.findByRole('heading', { name: 'Hair' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Beard' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Care' })).toBeTruthy();
  const row = screen.getByText('Haircut').closest('li')!;
  expect(row.textContent).toContain('৳300');
  expect(row.textContent).toContain('30 min');
});

test('a failed load shows the error', async () => {
  stubFetch(() => ({ status: 500, body: { error: 'Something went wrong' } }));
  renderApp(<Catalog />);
  expect((await screen.findByRole('alert')).textContent).toBe('Something went wrong');
});
