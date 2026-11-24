import { expect, test } from 'vitest';
import request from 'supertest';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { makeApp } from './testkit.ts';

test('guest gets a session with only a name', async () => {
  const app = makeApp();
  const res = await request(app).post('/api/auth/guest').send({ name: ' Rafi ' });
  expect(res.status).toBe(201);
  expect(res.body.user).toEqual({ id: expect.any(Number), name: 'Rafi', phone: null, isGuest: true });
  const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.token}`);
  expect(me.body.user.name).toBe('Rafi');
});

test('guest name is required', async () => {
  for (const body of [{}, { name: '   ' }, { name: 'x'.repeat(41) }, { name: 5 }])
    expect((await request(makeApp()).post('/api/auth/guest').send(body)).status).toBe(400);
});

test('register then login', async () => {
  const app = makeApp();
  const reg = await request(app).post('/api/auth/register').send({ name: 'Mina', phone: '+8801712345678', password: 'secret1' });
  expect(reg.status).toBe(201);
  expect(reg.body.user.isGuest).toBe(false);
  const ok = await request(app).post('/api/auth/login').send({ phone: '+8801712345678', password: 'secret1' });
  expect(ok.status).toBe(200);
  expect(ok.body.token).not.toBe(reg.body.token);
  const bad = await request(app).post('/api/auth/login').send({ phone: '+8801712345678', password: 'wrong' });
  expect(bad.status).toBe(401);
});

test('register validation and duplicates', async () => {
  const app = makeApp();
  const good = { name: 'Mina', phone: '01712345678', password: 'secret1' };
  expect((await request(app).post('/api/auth/register').send({ ...good, phone: 'abc' })).status).toBe(400);
  expect((await request(app).post('/api/auth/register').send({ ...good, password: '12345' })).status).toBe(400);
  expect((await request(app).post('/api/auth/register').send(good)).status).toBe(201);
  expect((await request(app).post('/api/auth/register').send(good)).status).toBe(409);
});

test('me rejects missing and unknown tokens', async () => {
  const app = makeApp();
  expect((await request(app).get('/api/auth/me')).status).toBe(401);
  expect((await request(app).get('/api/auth/me').set('Authorization', 'Bearer nope')).status).toBe(401);
});

test('password is not stored in plain text', async () => {
  const db = openDb(':memory:');
  await request(createApp(db, { staffPin: '1234' })).post('/api/auth/register').send({ name: 'Mina', phone: '01712345678', password: 'secret1' });
  const row = db.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
  expect(row.password_hash).not.toContain('secret1');
});

test('login with a non-string body field is a 401, not a crash', async () => {
  const res = await request(makeApp()).post('/api/auth/login').send({ phone: 5, password: null });
  expect(res.status).toBe(401);
});
