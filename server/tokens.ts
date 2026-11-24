import { Router } from 'express';
import type { RequestHandler } from 'express';
import { timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { requireUser } from './auth.ts';
import type { User } from './auth.ts';
import { HttpError } from './http.ts';
import { dayKey, estimateWaitMinutes, isWithinNotifyWindow } from './queue.ts';
import type { AheadToken } from './queue.ts';

type Status = 'waiting' | 'serving' | 'done' | 'cancelled';

export type TokenView = {
  number: number;
  status: Status;
  serviceName: string;
  hairstyleKey: string | null;
  aheadCount: number;
  etaMinutes: number;
  notifySoon: boolean;
};

export type StaffToken = {
  number: number;
  status: Status;
  customerName: string;
  serviceName: string;
  hairstyleKey: string | null;
};

type TokenRow = { id: number; number: number; status: Status; serviceName: string; hairstyleKey: string | null };

const ACTIVE = "t.status IN ('waiting', 'serving')";

export function tokensRouter(db: DatabaseSync, opts: { staffPin: string; now: () => Date }): Router {
  const router = Router();
  const user = requireUser(db);
  const today = () => dayKey(opts.now());

  const findMine = db.prepare(
    `SELECT t.id, t.number, t.status, s.name AS serviceName, t.hairstyle_key AS hairstyleKey
     FROM tokens t JOIN services s ON s.id = t.service_id
     WHERE t.user_id = ? AND t.day = ? AND ${ACTIVE}`,
  );
  const findAhead = db.prepare(
    `SELECT t.status, s.duration_min AS durationMin, t.started_at AS startedAt
     FROM tokens t JOIN services s ON s.id = t.service_id
     WHERE t.day = ? AND t.number < ? AND ${ACTIVE}`,
  );
  const findService = db.prepare('SELECT id FROM services WHERE id = ?');
  const maxNumber = db.prepare('SELECT COALESCE(MAX(number), 0) AS n FROM tokens WHERE day = ?');
  const insert = db.prepare(
    `INSERT INTO tokens(day, number, user_id, service_id, hairstyle_key, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'waiting', ?)`,
  );
  const setStatus = db.prepare('UPDATE tokens SET status = ? WHERE id = ?');
  const startServing = db.prepare("UPDATE tokens SET status = 'serving', started_at = ? WHERE id = ?");
  const staffList = db.prepare(
    `SELECT t.id, t.number, t.status, u.name AS customerName, s.name AS serviceName, t.hairstyle_key AS hairstyleKey
     FROM tokens t JOIN services s ON s.id = t.service_id JOIN users u ON u.id = t.user_id
     WHERE t.day = ? AND ${ACTIVE} ORDER BY t.number`,
  );

  const view = (row: TokenRow): TokenView => {
    const ahead = findAhead.all(today(), row.number) as AheadToken[];
    const etaMinutes = estimateWaitMinutes(ahead, opts.now());
    return {
      number: row.number,
      status: row.status,
      serviceName: row.serviceName,
      hairstyleKey: row.hairstyleKey,
      aheadCount: ahead.length,
      etaMinutes,
      notifySoon: isWithinNotifyWindow(row.status, etaMinutes),
    };
  };

  const mine = (u: User) => findMine.get(u.id, today()) as TokenRow | undefined;

  type StaffRow = StaffToken & { id: number };
  const staffRows = () => staffList.all(today()) as StaffRow[];
  const toStaff = ({ id: _id, ...rest }: StaffRow): StaffToken => rest;

  router.post('/tokens', user, (req, res) => {
    const u = res.locals.user as User;
    const serviceId = req.body?.serviceId;
    const hairstyleKey = req.body?.hairstyleKey ?? null;
    if (!Number.isInteger(serviceId) || !findService.get(serviceId))
      throw new HttpError(400, 'Please choose a service');
    if (hairstyleKey !== null && (typeof hairstyleKey !== 'string' || hairstyleKey.length < 1 || hairstyleKey.length > 30))
      throw new HttpError(400, 'Unknown hairstyle');
    if (mine(u)) throw new HttpError(409, 'You already have a token today');
    const day = today();
    const { n } = maxNumber.get(day) as { n: number };
    insert.run(day, n + 1, u.id, serviceId, hairstyleKey, opts.now().toISOString());
    res.status(201).json({ token: view(mine(u)!) });
  });

  router.get('/tokens/mine', user, (_req, res) => {
    const row = mine(res.locals.user as User);
    res.json({ token: row ? view(row) : null });
  });

  router.delete('/tokens/mine', user, (_req, res) => {
    const row = mine(res.locals.user as User);
    if (!row) throw new HttpError(404, 'You have no token');
    setStatus.run('cancelled', row.id);
    res.json({ ok: true });
  });

  router.get('/queue', (_req, res) => {
    const rows = staffRows();
    res.json({
      serving: rows.find((r) => r.status === 'serving')?.number ?? null,
      waitingCount: rows.filter((r) => r.status === 'waiting').length,
    });
  });

  const pinBytes = Buffer.from(opts.staffPin);
  const staff: RequestHandler = (req, _res, next) => {
    const given = Buffer.from(req.get('x-staff-pin') ?? '');
    if (given.length !== pinBytes.length || !timingSafeEqual(given, pinBytes)) throw new HttpError(401, 'Wrong PIN');
    next();
  };

  router.get('/staff/queue', staff, (_req, res) => {
    res.json({ tokens: staffRows().map(toStaff) });
  });

  router.post('/staff/next', staff, (_req, res) => {
    const rows = staffRows();
    for (const r of rows) if (r.status === 'serving') setStatus.run('done', r.id);
    const nextUp = rows.find((r) => r.status === 'waiting');
    if (!nextUp) {
      res.json({ serving: null });
      return;
    }
    startServing.run(opts.now().toISOString(), nextUp.id);
    res.json({ serving: toStaff({ ...nextUp, status: 'serving' }) });
  });

  return router;
}
