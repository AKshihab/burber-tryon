import { beforeEach, expect, test, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { BusyError } from './hairEdit.ts';
import type { HairEditor } from './hairEdit.ts';
import { DAILY_PER_USER, DAILY_TOTAL, KEEP_MS, MAX_WAITING } from './looks.ts';
import { guest } from './testkit.ts';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 7]);
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

type Call = { photo: Buffer; prompt: string; resolve(): void; reject(e: unknown): void };
let calls: Call[];
let clock: Date;
let app: Express;
const editor: HairEditor = (photo, prompt) =>
  new Promise((res, rej) => {
    calls.push({ photo, prompt, resolve: () => res({ bytes: PNG, type: 'image/png' }), reject: rej });
  });

const make = (e: HairEditor | undefined) =>
  createApp(openDb(':memory:'), { staffPin: '1234', now: () => clock, hairEditor: e, sleep: async () => {} });

beforeEach(() => {
  calls = [];
  clock = new Date('2026-11-25T10:00:00');
  app = make(editor);
});

const post = (t: string, body: Buffer = JPEG, style = 'buzz', color = '#1b1b1b') =>
  request(app).post('/api/looks').query({ style, color }).set(auth(t)).set('Content-Type', 'image/jpeg').send(body);
const mine = async (t: string) => (await request(app).get('/api/looks/mine').set(auth(t))).body;
const image = (t: string, id: string) => request(app).get(`/api/looks/${id}/image`).set(auth(t));
const remove = (t: string) => request(app).delete('/api/looks/mine').set(auth(t));
const settle = () => new Promise((r) => setTimeout(r, 10));

test('a look needs a session', async () => {
  expect((await request(app).post('/api/looks').set('Content-Type', 'image/jpeg').send(JPEG)).status).toBe(401);
  expect((await request(app).get('/api/looks/mine')).status).toBe(401);
  expect((await request(app).delete('/api/looks/mine')).status).toBe(401);
  expect((await request(app).get('/api/looks/x/image')).status).toBe(401);
  expect(calls).toHaveLength(0);
});

test('without a key the feature says it is unavailable', async () => {
  app = make(undefined);
  const t = await guest(app, 'A');
  expect(await mine(t)).toEqual({ available: false, look: null });
  expect((await post(t)).status).toBe(503);
});

test('a photo becomes a picture only its owner can see', async () => {
  const a = await guest(app, 'A'), b = await guest(app, 'B');
  expect(await mine(a)).toEqual({ available: true, look: null });
  const r = await post(a, JPEG, 'quiff', '#5a3825');
  expect(r.status).toBe(202);
  const id = r.body.look.id as string;
  expect(r.body.look).toEqual({ id: expect.any(String), status: 'working', ahead: 0, styleKey: 'quiff' });
  expect(calls[0].photo).toEqual(JPEG);
  expect(calls[0].prompt).toMatch(/quiff/);
  expect(calls[0].prompt).toMatch(/brown/);
  expect((await image(a, id)).status).toBe(404);

  calls[0].resolve();
  await settle();
  expect((await mine(a)).look.status).toBe('done');
  const img = await image(a, id);
  expect(img.status).toBe(200);
  expect(img.headers['content-type']).toBe('image/png');
  expect(img.headers['cache-control']).toBe('no-store');
  expect(img.body).toEqual(PNG);
  expect((await image(b, id)).status).toBe(404);
  expect((await mine(b)).look).toBeNull();
});

test('only a JPEG and a known haircut and colour are accepted', async () => {
  const t = await guest(app, 'A');
  expect((await post(t, Buffer.from('<svg onload=1>'))).status).toBe(400);
  expect((await post(t, Buffer.alloc(0))).status).toBe(400);
  expect((await post(t, JPEG, 'mohawk')).status).toBe(400);
  expect((await post(t, JPEG, 'buzz', 'red')).status).toBe(400);
  const asJson = await request(app).post('/api/looks?style=buzz&color=%231b1b1b').set(auth(t)).send({ a: 1 });
  expect(asJson.status).toBe(400);
  expect(calls).toHaveLength(0);
});

test('a very large photo is refused with a reason', async () => {
  const t = await guest(app, 'A');
  const big = await post(t, Buffer.concat([JPEG, Buffer.alloc(2_100_000)]));
  expect(big.status).toBe(413);
  expect(big.body.error).toMatch(/too large/i);
  expect(calls).toHaveLength(0);
});

test('photos are made one at a time, in order', async () => {
  const a = await guest(app, 'A'), b = await guest(app, 'B');
  await post(a);
  const second = await post(b);
  expect(second.body.look).toMatchObject({ status: 'waiting', ahead: 1 });
  expect(calls).toHaveLength(1);
  calls[0].resolve();
  await settle();
  expect(calls).toHaveLength(2);
  expect((await mine(b)).look).toMatchObject({ status: 'working', ahead: 0 });
});

test('a customer cannot start a second look while one is being made', async () => {
  const t = await guest(app, 'A');
  await post(t);
  expect((await post(t)).status).toBe(409);
  expect(calls).toHaveLength(1);
});

test('busy is retried, and the next customer is not held up for ever', async () => {
  const a = await guest(app, 'A'), b = await guest(app, 'B');
  await post(a);
  await post(b);
  for (let i = 0; i < 3; i++) {
    expect(calls).toHaveLength(i + 1);
    calls[i].reject(new BusyError());
    await settle();
  }
  expect((await mine(a)).look).toMatchObject({ status: 'failed' });
  expect((await mine(b)).look.status).toBe('working');
});

test('another failure is not retried, is logged, and the customer can try again', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const t = await guest(app, 'A');
  await post(t);
  calls[0].reject(new Error('boom'));
  await settle();
  expect(calls).toHaveLength(1);
  expect((await mine(t)).look.status).toBe('failed');
  expect(log).toHaveBeenCalledTimes(1);
  log.mockRestore();
  expect((await post(t)).status).toBe(202);
});

test('a customer has a daily limit; failed looks do not count', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const t = await guest(app, 'A');
  await post(t);
  calls[0].reject(new Error('boom'));
  await settle();
  for (let i = 1; i <= DAILY_PER_USER; i++) {
    expect((await post(t)).status).toBe(202);
    calls[i].resolve();
    await settle();
  }
  const over = await post(t);
  expect(over.status).toBe(429);
  expect(over.body.error).toMatch(/today/);
  clock = new Date('2026-11-26T10:00:00');
  expect((await post(t)).status).toBe(202);
  log.mockRestore();
});

test('the whole salon has a daily limit, so new guest names cannot run it up', async () => {
  app = make(async () => ({ bytes: PNG, type: 'image/png' }));
  for (let i = 0; i < DAILY_TOTAL; i++) {
    const t = await guest(app, 'G');
    expect((await post(t)).status).toBe(202);
  }
  await settle();
  expect((await post(await guest(app, 'G'))).status).toBe(429);
}, 30_000);

test('a long line is turned away instead of piling up photos', async () => {
  for (let i = 0; i <= MAX_WAITING; i++) expect((await post(await guest(app, 'G'))).status).toBe(202);
  const full = await post(await guest(app, 'G'));
  expect(full.status).toBe(503);
  expect(full.body.error).toMatch(/busy/i);
});

test('the customer can delete the picture', async () => {
  const t = await guest(app, 'A');
  const id = (await post(t)).body.look.id;
  calls[0].resolve();
  await settle();
  expect((await remove(t)).body).toEqual({ ok: true });
  expect((await image(t, id)).status).toBe(404);
  expect((await mine(t)).look).toBeNull();
});

test('a waiting photo that is deleted is never sent', async () => {
  const a = await guest(app, 'A'), b = await guest(app, 'B');
  await post(a);
  await post(b);
  await remove(b);
  calls[0].resolve();
  await settle();
  expect(calls).toHaveLength(1);
});

test('deleting a photo that is already being made does not let a second one in beside it', async () => {
  const t = await guest(app, 'A');
  await post(t);
  await remove(t);
  expect((await post(t)).body.look).toMatchObject({ status: 'waiting', ahead: 1 });
  expect(calls).toHaveLength(1);
});

test('a picture deleted while it is being made does not come back, and still counts for the day', async () => {
  const t = await guest(app, 'A');
  for (let i = 0; i < DAILY_PER_USER; i++) {
    await post(t);
    await remove(t);
    calls[i].resolve();
    await settle();
    expect((await mine(t)).look).toBeNull();
  }
  expect((await post(t)).status).toBe(429);
});

test('pictures are forgotten after a while', async () => {
  const t = await guest(app, 'A');
  const id = (await post(t)).body.look.id;
  calls[0].resolve();
  await settle();
  clock = new Date(clock.getTime() + KEEP_MS + 1);
  expect((await image(t, id)).status).toBe(404);
  expect((await mine(t)).look).toBeNull();
});
