// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Styles } from './Styles.tsx';
import { renderApp } from '../testkit.tsx';

vi.mock('../hair/HairViewer.tsx', () => ({
  HairViewer: (p: { styleKey: string; color: string }) => (
    <div data-testid="viewer" data-style={p.styleKey} data-color={p.color} />
  ),
}));

const viewer = () => screen.getByTestId('viewer');
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

test('four tiles, buzz cut and black chosen by default', () => {
  renderApp(<Styles />);
  for (const name of ['Buzz cut', 'Side part', 'Quiff', 'Curly top']) expect(screen.getByRole('button', { name })).toBeTruthy();
  expect(pressed('Buzz cut')).toBe('true');
  expect(pressed('Quiff')).toBe('false');
  expect(viewer().dataset.style).toBe('buzz');
  expect(viewer().dataset.color).toBe('#1b1b1b');
});

test('choosing a style updates the head and is remembered', async () => {
  renderApp(<Styles />);
  await userEvent.click(screen.getByRole('button', { name: 'Quiff' }));
  expect(viewer().dataset.style).toBe('quiff');
  expect(pressed('Quiff')).toBe('true');
  expect(localStorage.getItem('salon.style')).toBe('quiff');
});

test('choosing a colour updates the head and is remembered', async () => {
  renderApp(<Styles />);
  await userEvent.click(screen.getByRole('button', { name: 'Blonde' }));
  expect(viewer().dataset.color).toBe('#c9a25d');
  expect(localStorage.getItem('salon.hairColor')).toBe('#c9a25d');
});

test('a remembered choice is restored', () => {
  localStorage.setItem('salon.style', 'curly');
  localStorage.setItem('salon.hairColor', '#8c3b20');
  renderApp(<Styles />);
  expect(viewer().dataset.style).toBe('curly');
  expect(viewer().dataset.color).toBe('#8c3b20');
  expect(pressed('Red')).toBe('true');
});

test('junk in storage falls back to the defaults', () => {
  localStorage.setItem('salon.style', 'mullet');
  localStorage.setItem('salon.hairColor', 'javascript:alert(1)');
  renderApp(<Styles />);
  expect(viewer().dataset.style).toBe('buzz');
  expect(viewer().dataset.color).toBe('#1b1b1b');
});

test('there is a way on to the token screen', () => {
  renderApp(<Styles />);
  expect(screen.getByRole('link', { name: 'Take a token with this style' }).getAttribute('href')).toBe('/token');
});
