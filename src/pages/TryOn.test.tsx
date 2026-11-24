// @vitest-environment jsdom
import { expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TryOn } from './TryOn.tsx';
import { renderApp } from '../testkit.tsx';

const DENIED = 'Camera permission was denied. Allow the camera for this site and try again.';

vi.mock('../tryon/TryOnView.tsx', () => ({
  TryOnView: (p: { styleKey: string; color: string; onHint(h: string): void; onError(m: string): void }) => (
    <div data-testid="camera" data-style={p.styleKey} data-color={p.color}>
      <button type="button" onClick={() => p.onHint('closer')}>
        fake hint
      </button>
      <button type="button" onClick={() => p.onHint('ok')}>
        fake ok
      </button>
      <button type="button" onClick={() => p.onError(DENIED)}>
        fake error
      </button>
    </div>
  ),
}));

const start = () => userEvent.click(screen.getByRole('button', { name: 'Start camera' }));

test('the camera is not touched until the customer asks', () => {
  renderApp(<TryOn />);
  expect(screen.queryByTestId('camera')).toBeNull();
  expect(screen.getByRole('button', { name: 'Start camera' })).toBeTruthy();
  expect(screen.getByText('Your camera picture stays on this device.')).toBeTruthy();
});

test('starting the camera shows the view with the remembered style and colour', async () => {
  localStorage.setItem('salon.style', 'curly');
  localStorage.setItem('salon.hairColor', '#5a3825');
  renderApp(<TryOn />);
  await start();
  const camera = screen.getByTestId('camera');
  expect(camera.dataset.style).toBe('curly');
  expect(camera.dataset.color).toBe('#5a3825');
  expect(screen.getByRole('status').textContent).toBe('Put your face inside the oval');
});

test('choosing another haircut changes the hair on the camera view and is remembered', async () => {
  renderApp(<TryOn />);
  await start();
  await userEvent.click(screen.getByRole('button', { name: 'Quiff' }));
  expect(screen.getByTestId('camera').dataset.style).toBe('quiff');
  expect(localStorage.getItem('salon.style')).toBe('quiff');
});

test('the hint follows the face', async () => {
  renderApp(<TryOn />);
  await start();
  await userEvent.click(screen.getByRole('button', { name: 'fake hint' }));
  expect(screen.getByRole('status').textContent).toBe('Move closer');
  await userEvent.click(screen.getByRole('button', { name: 'fake ok' }));
  expect(screen.getByRole('status').textContent).toBe('Looking good — turn your head to see the sides');
});

test('a camera problem is explained, the camera is closed, and the 3D preview is offered', async () => {
  renderApp(<TryOn />);
  await start();
  await userEvent.click(screen.getByRole('button', { name: 'fake error' }));
  expect(screen.getByRole('alert').textContent).toBe(DENIED);
  expect(screen.queryByTestId('camera')).toBeNull();
  expect(screen.getByRole('link', { name: 'Use the 3D preview instead' }).getAttribute('href')).toBe('/styles');
  expect(screen.getByRole('button', { name: 'Start camera' })).toBeTruthy();
});

test('the camera can be stopped', async () => {
  renderApp(<TryOn />);
  await start();
  await userEvent.click(screen.getByRole('button', { name: 'Stop camera' }));
  expect(screen.queryByTestId('camera')).toBeNull();
});
