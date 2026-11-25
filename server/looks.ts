import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { requireUser } from './auth.ts';
import type { User } from './auth.ts';
import { BusyError, hairPrompt } from './hairEdit.ts';
import type { HairEditor, Picture } from './hairEdit.ts';
import { HttpError } from './http.ts';
import { dayKey } from './queue.ts';

export const DAILY_PER_USER = 6;
export const DAILY_TOTAL = 150;
export const MAX_WAITING = 8;
/** Finished pictures are dropped from memory after this long. Nothing is written to disk. */
export const KEEP_MS = 30 * 60_000;
const ATTEMPTS = 3;
const RETRY_MS = 5_000;

type Look = {
  id: string;
  userId: number;
  day: string;
  styleKey: string;
  prompt: string;
  status: 'waiting' | 'working' | 'done' | 'failed';
  photo: Buffer | null;
  picture: Picture | null;
  finishedAt: number;
};

export type LookView = { id: string; status: Look['status']; ahead: number; styleKey: string };

type Options = {
  now: () => Date;
  editor?: HairEditor;
  sleep?: (ms: number) => Promise<void>;
};

const isJpeg = (b: unknown): b is Buffer =>
  Buffer.isBuffer(b) && b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;

/** "See my haircut": the customer's photo is edited by the picture service, one photo at a time. */
export function looksRouter(db: DatabaseSync, opts: Options): Router {
  const router = Router();
  const user = requireUser(db);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  /** The photos being made or waiting; the first one is being made. */
  const line: Look[] = [];
  /** Each customer's most recent look, unless they deleted it. */
  const latest = new Map<number, Look>();
  let used = { day: '', total: 0, byUser: new Map<number, number>() };

  const usage = () => {
    const day = dayKey(opts.now());
    if (used.day !== day) used = { day, total: 0, byUser: new Map() };
    return used;
  };
  const count = (userId: number, by: 1 | -1) => {
    const u = usage();
    u.total += by;
    u.byUser.set(userId, (u.byUser.get(userId) ?? 0) + by);
  };

  const forgetOld = () => {
    const limit = opts.now().getTime() - KEEP_MS;
    for (const [id, l] of latest) if (l.finishedAt > 0 && l.finishedAt < limit) latest.delete(id);
  };
  const find = (u: User) => {
    forgetOld();
    return latest.get(u.id);
  };
  const view = (l: Look): LookView => ({
    id: l.id,
    status: l.status,
    ahead: Math.max(0, line.indexOf(l)),
    styleKey: l.styleKey,
  });

  async function make(look: Look, editor: HairEditor): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        look.picture = await editor(look.photo!, look.prompt);
        look.status = 'done';
        return;
      } catch (err) {
        if (err instanceof BusyError && attempt < ATTEMPTS) {
          await sleep(RETRY_MS);
          continue;
        }
        if (!(err instanceof BusyError)) console.error('Haircut picture failed:', err);
        look.status = 'failed';
        if (look.day === usage().day) count(look.userId, -1);
        return;
      }
    }
  }

  async function work(editor: HairEditor): Promise<void> {
    while (line.length > 0) {
      const look = line[0];
      look.status = 'working';
      await make(look, editor);
      look.photo = null;
      look.finishedAt = opts.now().getTime();
      if (latest.get(look.userId) !== look) look.picture = null;
      else setTimeout(forgetOld, KEEP_MS + 1000).unref();
      line.shift();
    }
  }

  router.get('/mine', user, (_req, res) => {
    const look = find(res.locals.user as User);
    res.json({ available: !!opts.editor, look: look ? view(look) : null });
  });

  router.post('/', user, express.raw({ type: 'image/jpeg', limit: '2mb' }), (req, res) => {
    const u = res.locals.user as User;
    const editor = opts.editor;
    if (!editor) throw new HttpError(503, 'Haircut pictures are not available right now');
    const prompt = hairPrompt(req.query.style, req.query.color);
    if (!prompt) throw new HttpError(400, 'Please choose a haircut and a colour');
    if (!isJpeg(req.body)) throw new HttpError(400, 'Please take a photo first');
    const current = find(u);
    if (current && (current.status === 'waiting' || current.status === 'working'))
      throw new HttpError(409, 'Your picture is already being made');
    const { total, byUser, day } = usage();
    if ((byUser.get(u.id) ?? 0) >= DAILY_PER_USER)
      throw new HttpError(429, `You have made ${DAILY_PER_USER} pictures today. Please come back tomorrow.`);
    if (total >= DAILY_TOTAL) throw new HttpError(429, 'No more pictures can be made today. Please come back tomorrow.');
    if (line.length > MAX_WAITING) throw new HttpError(503, 'Pictures are busy right now. Please try again in a few minutes.');

    const look: Look = {
      id: randomUUID(),
      userId: u.id,
      day,
      styleKey: req.query.style as string,
      prompt,
      status: 'waiting',
      photo: req.body,
      picture: null,
      finishedAt: 0,
    };
    count(u.id, 1);
    latest.set(u.id, look);
    line.push(look);
    if (line.length === 1) void work(editor);
    res.status(202).json({ look: view(look) });
  });

  router.get('/:id/image', user, (req, res) => {
    const look = find(res.locals.user as User);
    if (!look?.picture || look.id !== req.params.id) throw new HttpError(404, 'Picture not found');
    res.set('Cache-Control', 'no-store').type(look.picture.type).send(look.picture.bytes);
  });

  router.delete('/mine', user, (_req, res) => {
    const look = find(res.locals.user as User);
    if (look) {
      latest.delete(look.userId);
      look.picture = null;
      // A waiting photo is taken out of the line; one already sent has to finish, and its result is dropped.
      if (look.status === 'waiting') line.splice(line.indexOf(look), 1);
    }
    res.json({ ok: true });
  });

  return router;
}
