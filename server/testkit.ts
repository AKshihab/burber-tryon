import request from 'supertest';
import type { Express } from 'express';
import { createApp } from './app.ts';
import { openDb } from './db.ts';

export const makeApp = () => createApp(openDb(':memory:'), { staffPin: '1234' });

export async function guest(app: Express, name: string): Promise<string> {
  const res = await request(app).post('/api/auth/guest').send({ name });
  return res.body.token as string;
}
