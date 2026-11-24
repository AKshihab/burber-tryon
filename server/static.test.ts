import { afterAll, beforeAll, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.ts';
import { openDb } from './db.ts';

let dir: string;
let app: Express;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'salon-static-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<title>salon</title>');
  fs.writeFileSync(path.join(dir, 'app.js'), 'console.log(1)');
  app = createApp(openDb(':memory:'), { staffPin: '1234', staticDir: dir });
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a page address like /review gets the app shell', async () => {
  const res = await request(app).get('/review');
  expect(res.status).toBe(200);
  expect(res.text).toContain('<title>salon</title>');
});

test('built files are served', async () => {
  const res = await request(app).get('/app.js');
  expect(res.status).toBe(200);
  expect(res.text).toBe('console.log(1)');
});

test('the api still answers in JSON', async () => {
  expect((await request(app).get('/api/health')).body).toEqual({ ok: true });
  const missing = await request(app).get('/api/nope');
  expect(missing.status).toBe(404);
  expect(missing.body.error).toEqual(expect.any(String));
});

test('a missing file is a 404, not the app shell', async () => {
  const res = await request(app).get('/mediapipe/missing.wasm');
  expect(res.status).toBe(404);
});
