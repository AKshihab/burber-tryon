import { expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';
import { openDb } from './db.ts';

const makeApp = () => createApp(openDb(':memory:'), { staffPin: '1234' });

test('health', async () => {
  const res = await request(makeApp()).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});

test('services are seeded once', async () => {
  const db = openDb(':memory:');
  const res = await request(createApp(db, { staffPin: '1234' })).get('/api/services');
  expect(res.body.services).toHaveLength(6);
  expect(res.body.services[0]).toEqual({ id: 1, name: 'Haircut', category: 'Hair', price: 300, durationMin: 30 });
});

test('malformed JSON gives a 400 JSON error', async () => {
  const res = await request(makeApp()).post('/api/auth/guest').set('Content-Type', 'application/json').send('{bad');
  expect(res.status).toBe(400);
  expect(res.body.error).toEqual(expect.any(String));
});

test('unknown api route gives 404 JSON', async () => {
  const res = await request(makeApp()).get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body.error).toEqual(expect.any(String));
});
