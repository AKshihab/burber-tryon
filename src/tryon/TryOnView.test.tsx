// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import '../testkit.tsx';
import { TryOnView } from './TryOnView.tsx';

const tracker = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('./tracker.ts', () => ({ createFaceTracker: tracker.create }));

type Deferred<T> = { promise: Promise<T>; resolve(v: T): void; reject(e: unknown): void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeStream() {
  const stop = vi.fn();
  return { stop, stream: { getTracks: () => [{ stop }] } as unknown as MediaStream };
}

function stubCamera(getUserMedia: () => Promise<MediaStream>, secure = true) {
  vi.stubGlobal('isSecureContext', secure);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
}

const view = (onError = vi.fn(), onHint = vi.fn()) =>
  render(<TryOnView styleKey="buzz" color="#1b1b1b" onHint={onHint} onError={onError} />);

beforeEach(() => {
  tracker.create.mockReset();
  // jsdom has no media playback
  HTMLMediaElement.prototype.play = async () => {};
});

test('a camera that arrives after the customer has left is switched off', async () => {
  const pending = deferred<MediaStream>();
  stubCamera(() => pending.promise);
  const { unmount } = view();
  unmount();
  const cam = fakeStream();
  pending.resolve(cam.stream);
  await waitFor(() => expect(cam.stop).toHaveBeenCalledTimes(1));
  expect(tracker.create).not.toHaveBeenCalled();
});

test('a camera that is already running is switched off on leaving', async () => {
  const cam = fakeStream();
  stubCamera(async () => cam.stream);
  tracker.create.mockReturnValue(new Promise(() => {}));
  const { unmount } = view();
  await waitFor(() => expect(tracker.create).toHaveBeenCalled());
  unmount();
  expect(cam.stop).toHaveBeenCalledTimes(1);
});

test('a face tracker that finishes loading after the customer has left is closed', async () => {
  const cam = fakeStream();
  stubCamera(async () => cam.stream);
  const loading = deferred<{ detect(): null; close(): void }>();
  tracker.create.mockReturnValue(loading.promise);
  const { unmount } = view();
  await waitFor(() => expect(tracker.create).toHaveBeenCalled());
  unmount();
  const close = vi.fn();
  loading.resolve({ detect: () => null, close });
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
});

test('a refused camera is explained', async () => {
  stubCamera(async () => {
    throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
  });
  const onError = vi.fn();
  view(onError);
  await waitFor(() =>
    expect(onError).toHaveBeenCalledWith('Camera permission was denied. Allow the camera for this site and try again.'),
  );
});

test('an insecure page is explained without asking for the camera', async () => {
  const getUserMedia = vi.fn();
  stubCamera(getUserMedia, false);
  const onError = vi.fn();
  view(onError);
  await waitFor(() => expect(onError).toHaveBeenCalledWith('The camera only works on a secure (https) page.'));
  expect(getUserMedia).not.toHaveBeenCalled();
});

test('a face tracker that cannot load is explained and the camera is switched off on leaving', async () => {
  const cam = fakeStream();
  stubCamera(async () => cam.stream);
  tracker.create.mockRejectedValue(new Error('no wasm'));
  const onError = vi.fn();
  const { unmount } = view(onError);
  await waitFor(() =>
    expect(onError).toHaveBeenCalledWith('The face tracker could not be loaded. Use the 3D preview instead.'),
  );
  unmount();
  expect(cam.stop).toHaveBeenCalledTimes(1);
});
