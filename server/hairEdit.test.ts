import { expect, test, vi } from 'vitest';
import { HAIRSTYLES, HAIR_COLORS } from '../src/hair/styles.ts';
import { BusyError, createEuronEditor, hairPrompt } from './hairEdit.ts';

const PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const editor = (fetchFn: typeof fetch) => createEuronEditor({ apiKey: 'euri-secret', fetchFn });

test('every haircut and colour in the app has its own instruction', () => {
  const prompts = new Set<string>();
  for (const s of HAIRSTYLES)
    for (const c of HAIR_COLORS) {
      const p = hairPrompt(s.key, c.hex);
      expect(p).toContain(c.name.toLowerCase());
      expect(p).toMatch(/keep .*face/i);
      prompts.add(p!);
    }
  expect(prompts.size).toBe(HAIRSTYLES.length * HAIR_COLORS.length);
});

test('an unknown haircut or colour has no instruction', () => {
  expect(hairPrompt('mohawk', '#1b1b1b')).toBeNull();
  expect(hairPrompt('buzz', '#ffffff')).toBeNull();
  expect(hairPrompt('constructor', '#1b1b1b')).toBeNull();
});

test('the photo and instruction go to Euron with the key, and the result is downloaded', async () => {
  const fetchFn = vi
    .fn()
    .mockResolvedValueOnce(json({ data: [{ url: 'https://files.example/x.png' }] }))
    .mockResolvedValueOnce(new Response(PNG, { headers: { 'Content-Type': 'image/png' } }));
  const out = await editor(fetchFn)(PHOTO, 'a quiff');
  expect(out).toEqual({ bytes: PNG, type: 'image/png' });

  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe('https://api.euron.one/api/v1/euri/images/edits');
  expect(init.headers.Authorization).toBe('Bearer euri-secret');
  const form = init.body as FormData;
  expect(form.get('model')).toBe('euri-image-edit');
  expect(form.get('prompt')).toBe('a quiff');
  expect(Buffer.from(await (form.get('image') as File).arrayBuffer())).toEqual(PHOTO);
  // the key is for Euron only, not for wherever the result is stored
  expect(JSON.stringify(fetchFn.mock.calls[1])).not.toContain('euri-secret');
});

test('a picture sent inside the reply is used directly', async () => {
  const fetchFn = vi.fn().mockResolvedValueOnce(json({ data: [{ b64_json: PNG.toString('base64') }] }));
  expect(await editor(fetchFn)(PHOTO, 'x')).toEqual({ bytes: PNG, type: 'image/png' });
});

test('"busy" is recognised even though Euron answers it with status 200', async () => {
  const fetchFn = vi.fn().mockResolvedValueOnce(json({ error: { message: 'busy', code: 'euri_no_capacity' } }));
  await expect(editor(fetchFn)(PHOTO, 'x')).rejects.toBeInstanceOf(BusyError);
});

test('rate limiting and an unavailable service count as busy', async () => {
  for (const status of [429, 503]) {
    const fetchFn = vi.fn().mockResolvedValueOnce(json({ error: { message: 'no' } }, status));
    await expect(editor(fetchFn)(PHOTO, 'x')).rejects.toBeInstanceOf(BusyError);
  }
});

test('other failures are errors that never contain the key', async () => {
  const replies = [
    json({ error: { message: 'bad key euri-secret' } }, 401),
    json({ data: [] }),
    new Response('<html>', { status: 200 }),
    json({ data: [{ url: 'http://insecure.example/x.png' }] }),
  ];
  for (const r of replies) {
    const err = await editor(vi.fn().mockResolvedValueOnce(r))(PHOTO, 'x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(BusyError);
    expect(String(err)).not.toContain('euri-secret');
  }
});

test('a result that is not a picture is refused', async () => {
  const fetchFn = vi
    .fn()
    .mockResolvedValueOnce(json({ data: [{ url: 'https://files.example/x.png' }] }))
    .mockResolvedValueOnce(new Response('<html>', { headers: { 'Content-Type': 'text/html' } }));
  await expect(editor(fetchFn)(PHOTO, 'x')).rejects.toThrow();
});

test('the instruction names nothing the person may not have: the service has drawn glasses it was told to keep', () => {
  for (const s of HAIRSTYLES) expect(hairPrompt(s.key, '#1b1b1b')).not.toMatch(/glasses|beard|facial hair/i);
});
