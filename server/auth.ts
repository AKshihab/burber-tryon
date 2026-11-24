import { Router } from 'express';
import type { RequestHandler } from 'express';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { HttpError } from './http.ts';

export type User = { id: number; name: string; phone: string | null; isGuest: boolean };

type UserRow = { id: number; name: string; phone: string | null; is_guest: number; password_hash: string | null };

const PHONE = /^\+?\d{7,15}$/;

const toUser = (r: UserRow): User => ({ id: r.id, name: r.name, phone: r.phone, isGuest: r.is_guest === 1 });

function cleanName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name.length < 1 || name.length > 40) throw new HttpError(400, 'Please enter a name of 1 to 40 characters');
  return name;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function requireUser(db: DatabaseSync): RequestHandler {
  const find = db.prepare(
    'SELECT u.id, u.name, u.phone, u.is_guest, u.password_hash FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?',
  );
  return (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const row = token ? (find.get(token) as UserRow | undefined) : undefined;
    if (!row) throw new HttpError(401, 'Please sign in');
    res.locals.user = toUser(row);
    next();
  };
}

export function authRouter(db: DatabaseSync): Router {
  const router = Router();
  const insertUser = db.prepare(
    'INSERT INTO users(name, phone, password_hash, is_guest, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const byPhone = db.prepare('SELECT id, name, phone, is_guest, password_hash FROM users WHERE phone = ?');
  const byId = db.prepare('SELECT id, name, phone, is_guest, password_hash FROM users WHERE id = ?');
  const insertSession = db.prepare('INSERT INTO sessions(token, user_id) VALUES (?, ?)');

  const startSession = (userId: number) => {
    const token = randomBytes(32).toString('hex');
    insertSession.run(token, userId);
    return { token, user: toUser(byId.get(userId) as UserRow) };
  };

  router.post('/guest', (req, res) => {
    const name = cleanName(req.body?.name);
    const { lastInsertRowid } = insertUser.run(name, null, null, 1, new Date().toISOString());
    res.status(201).json(startSession(Number(lastInsertRowid)));
  });

  router.post('/register', (req, res) => {
    const name = cleanName(req.body?.name);
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const password = req.body?.password;
    if (!PHONE.test(phone)) throw new HttpError(400, 'Please enter a valid phone number');
    if (typeof password !== 'string' || password.length < 6 || password.length > 200)
      throw new HttpError(400, 'Password must be at least 6 characters');
    if (byPhone.get(phone)) throw new HttpError(409, 'Phone already registered');
    const { lastInsertRowid } = insertUser.run(name, phone, hashPassword(password), 0, new Date().toISOString());
    res.status(201).json(startSession(Number(lastInsertRowid)));
  });

  router.post('/login', (req, res) => {
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const row = phone ? (byPhone.get(phone) as UserRow | undefined) : undefined;
    if (!row?.password_hash || !verifyPassword(password, row.password_hash))
      throw new HttpError(401, 'Wrong phone number or password');
    res.json(startSession(row.id));
  });

  router.get('/me', requireUser(db), (_req, res) => {
    res.json({ user: res.locals.user });
  });

  return router;
}
