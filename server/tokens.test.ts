import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { guest } from './testkit.ts';

let clock: Date;
let app: Express;
const PIN = { 'x-staff-pin': '1234' };

beforeEach(() => {
  clock = new Date('2026-11-25T10:00:00');
  app = createApp(openDb(':memory:'), { staffPin: '1234', now: () => clock });
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const take = (t: string, body: unknown) => request(app).post('/api/tokens').set(auth(t)).send(body as object);
const mine = (t: string) => request(app).get('/api/tokens/mine').set(auth(t));
const next = () => request(app).post('/api/staff/next').set(PIN);

test('tokens are numbered from 1 and report the queue ahead', async () => {
  const a = await guest(app, 'A'), b = await guest(app, 'B');
  const t1 = await take(a, { serviceId: 1, hairstyleKey: 'quiff' });
  expect(t1.status).toBe(201);
  expect(t1.body.token).toEqual({ number: 1, status: 'waiting', serviceName: 'Haircut', hairstyleKey: 'quiff', aheadCount: 0, etaMinutes: 0, notifySoon: true });
  const t2 = await take(b, { serviceId: 2 });
  expect(t2.body.token).toMatchObject({ number: 2, hairstyleKey: null, aheadCount: 1, etaMinutes: 30, notifySoon: false });
});

test('eta shrinks as the serving customer progresses and crosses the 15 minute window', async () => {
  const a = await guest(app, 'A'), b = await guest(app, 'B');
  await take(a, { serviceId: 1 });
  await take(b, { serviceId: 2 });
  await next();
  expect((await mine(a)).body.token).toMatchObject({ status: 'serving', aheadCount: 0, notifySoon: false });
  clock = new Date('2026-11-25T10:10:00');
  expect((await mine(b)).body.token).toMatchObject({ etaMinutes: 20, notifySoon: false, aheadCount: 1 });
  clock = new Date('2026-11-25T10:15:00');
  expect((await mine(b)).body.token).toMatchObject({ etaMinutes: 15, notifySoon: true });
});

test('one active token per user', async () => {
  const a = await guest(app, 'A');
  expect((await take(a, { serviceId: 1 })).status).toBe(201);
  const again = await take(a, { serviceId: 2 });
  expect(again.status).toBe(409);
  expect(again.body.error).toEqual(expect.any(String));
});

test('taking a token needs a session and a real service', async () => {
  expect((await request(app).post('/api/tokens').send({ serviceId: 1 })).status).toBe(401);
  const a = await guest(app, 'A');
  expect((await take(a, { serviceId: 999 })).status).toBe(400);
  expect((await take(a, { serviceId: 'x' })).status).toBe(400);
  expect((await take(a, {})).status).toBe(400);
  expect((await take(a, { serviceId: 1, hairstyleKey: 7 })).status).toBe(400);
  expect((await take(a, { serviceId: 1, hairstyleKey: 'x'.repeat(31) })).status).toBe(400);
});

test('mine is null without a token, and cancel frees the user', async () => {
  const a = await guest(app, 'A');
  expect((await mine(a)).body).toEqual({ token: null });
  expect((await request(app).delete('/api/tokens/mine').set(auth(a))).status).toBe(404);
  await take(a, { serviceId: 1 });
  const del = await request(app).delete('/api/tokens/mine').set(auth(a));
  expect(del.status).toBe(200);
  expect(del.body).toEqual({ ok: true });
  expect((await mine(a)).body).toEqual({ token: null });
  const again = await take(a, { serviceId: 1 });
  expect(again.status).toBe(201);
  expect(again.body.token).toMatchObject({ number: 2, aheadCount: 0 });
});

test('a waiting token from yesterday is ignored and numbering restarts', async () => {
  const a = await guest(app, 'A');
  await take(a, { serviceId: 1 });
  clock = new Date('2026-11-26T09:00:00');
  expect((await mine(a)).body).toEqual({ token: null });
  const t = await take(a, { serviceId: 1 });
  expect(t.status).toBe(201);
  expect(t.body.token.number).toBe(1);
  expect((await request(app).get('/api/queue')).body).toEqual({ serving: null, waitingCount: 1 });
});

test('staff routes need the pin', async () => {
  expect((await request(app).get('/api/staff/queue')).status).toBe(401);
  expect((await request(app).post('/api/staff/next').set('x-staff-pin', '0000')).status).toBe(401);
});

test('staff next on an empty queue is not an error', async () => {
  const res = await next();
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ serving: null });
});

test('staff next advances the queue', async () => {
  const a = await guest(app, 'A'), b = await guest(app, 'B');
  await take(a, { serviceId: 1, hairstyleKey: 'buzz' });
  await take(b, { serviceId: 2 });
  const first = await next();
  expect(first.body.serving).toEqual({ number: 1, status: 'serving', customerName: 'A', serviceName: 'Haircut', hairstyleKey: 'buzz' });
  expect((await request(app).get('/api/queue')).body).toEqual({ serving: 1, waitingCount: 1 });
  const list = await request(app).get('/api/staff/queue').set(PIN);
  expect(list.body.tokens.map((t: { number: number; status: string }) => [t.number, t.status])).toEqual([[1, 'serving'], [2, 'waiting']]);
  expect((await next()).body.serving).toMatchObject({ number: 2, customerName: 'B' });
  expect((await mine(a)).body).toEqual({ token: null });
  expect((await next()).body).toEqual({ serving: null });
  expect((await request(app).get('/api/staff/queue').set(PIN)).body).toEqual({ tokens: [] });
});
