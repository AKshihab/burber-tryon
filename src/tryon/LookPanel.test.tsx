// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, stubFetch } from '../testkit.tsx';
import type { Call, Reply } from '../testkit.tsx';
import { LookPanel } from './LookPanel.tsx';

type Look = { id: string; status: string; ahead: number; styleKey: string } | null;
let look: Look;
let available: boolean;
let postReply: Reply;
let calls: Call[];
let made: Blob[];

const working = (over: object = {}) => ({ id: 'L1', status: 'working', ahead: 0, styleKey: 'quiff', ...over });

beforeEach(() => {
  look = null;
  available = true;
  made = [];
  postReply = { status: 202, body: { look: working() } };
  URL.createObjectURL = (b) => {
    made.push(b as Blob);
    return `blob:${made.length}`;
  };
  URL.revokeObjectURL = vi.fn();
  calls = stubFetch((c) => {
    if (c.url === '/api/looks/mine' && c.method === 'DELETE') {
      look = null;
      return { body: { ok: true } };
    }
    if (c.url === '/api/looks/mine') return { body: { available, look } };
    if (c.method === 'POST') {
      if ((postReply.status ?? 200) < 300) look = working();
      return postReply;
    }
    return { text: 'picture' };
  });
});

const photo = new Blob(['photo'], { type: 'image/jpeg' });
const panel = (over: Partial<Parameters<typeof LookPanel>[0]> = {}) =>
  renderApp(
    <LookPanel styleKey="quiff" color="#5a3825" capture={async () => photo} faceReady pollMs={10} {...over} />,
  );
const agree = async () => userEvent.click(await screen.findByRole('checkbox'));
const go = () => screen.getByRole<HTMLButtonElement>('button', { name: 'See my haircut' });
const posts = () => calls.filter((c) => c.method === 'POST');

test('nothing is shown when the salon has not set the feature up', async () => {
  available = false;
  const { container } = panel();
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(container.textContent).toBe('');
});

test('no photo can be sent before the customer agrees, and the notice says where it goes', async () => {
  panel();
  expect((await screen.findByText(/Euron/)).textContent).toMatch(/outside/);
  expect(go().disabled).toBe(true);
  await agree();
  expect(go().disabled).toBe(false);
  expect(posts()).toHaveLength(0);
});

test('a photo needs the camera and a face', async () => {
  panel({ faceReady: false });
  await agree();
  expect(go().disabled).toBe(true);
});

test('a photo needs the camera to be running', async () => {
  panel({ capture: null });
  await agree();
  expect(go().disabled).toBe(true);
  expect(screen.getByText(/Start the camera/)).toBeTruthy();
});

test('the photo goes to the salon with the chosen cut and colour, then before and after are shown', async () => {
  panel();
  await agree();
  await userEvent.click(go());
  expect(posts()[0].url).toBe('/api/looks?style=quiff&color=%235a3825');
  expect(posts()[0].headers['Content-Type']).toBe('image/jpeg');
  expect((await screen.findByRole('status')).textContent).toMatch(/Making your picture/);
  expect(screen.queryByRole('button', { name: 'See my haircut' })).toBeNull();

  look = working({ status: 'done' });
  const after = await screen.findByAltText<HTMLImageElement>('You with the quiff');
  const before = screen.getByAltText<HTMLImageElement>('Your photo');
  expect(before.src).not.toBe(after.src);
  expect(calls.some((c) => c.url === '/api/looks/L1/image')).toBe(true);
  expect(screen.getByRole('link', { name: 'Save picture' }).getAttribute('download')).toBeTruthy();
  expect(go()).toBeTruthy();
});

test('a customer in line is told how many are ahead', async () => {
  look = working({ status: 'waiting', ahead: 2 });
  panel();
  await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/2 ahead of you/));
});

test('a picture made while the customer was on another page is shown on return', async () => {
  look = working({ status: 'done' });
  panel();
  expect(await screen.findByAltText('You with the quiff')).toBeTruthy();
  expect(screen.queryByAltText('Your photo')).toBeNull();
});

test('a refusal from the salon is shown', async () => {
  postReply = { status: 429, body: { error: 'You have made 6 pictures today.' } };
  panel();
  await agree();
  await userEvent.click(go());
  expect((await screen.findByRole('alert')).textContent).toBe('You have made 6 pictures today.');
  expect(go().disabled).toBe(false);
});

test('a photo that cannot be taken is explained', async () => {
  panel({
    capture: async () => {
      throw new Error('no frame');
    },
  });
  await agree();
  await userEvent.click(go());
  expect((await screen.findByRole('alert')).textContent).toMatch(/photo could not be taken/);
  expect(posts()).toHaveLength(0);
});

test('a failed picture can be tried again', async () => {
  panel();
  await agree();
  await userEvent.click(go());
  look = working({ status: 'failed' });
  expect((await screen.findByRole('alert')).textContent).toMatch(/could not be made/);
  expect(go().disabled).toBe(false);
});

test('a picture the salon has lost is explained instead of waiting for ever', async () => {
  panel();
  await agree();
  await userEvent.click(go());
  await screen.findByRole('status');
  look = null;
  expect((await screen.findByRole('alert')).textContent).toMatch(/lost/);
});

test('the customer can delete the picture', async () => {
  look = working({ status: 'done' });
  panel();
  await userEvent.click(await screen.findByRole('button', { name: 'Delete picture' }));
  await waitFor(() => expect(screen.queryByAltText('You with the quiff')).toBeNull());
  expect(calls.some((c) => c.method === 'DELETE')).toBe(true);
});

test('checking stops when the customer leaves', async () => {
  look = working();
  const { unmount } = panel();
  await screen.findByRole('status');
  unmount();
  const n = calls.length;
  await new Promise((r) => setTimeout(r, 60));
  expect(calls.length).toBe(n);
});
