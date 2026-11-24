import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { HttpError } from './http.ts';

export type Review = { rating: number; comment: string; name: string; createdAt: string };

function optionalText(value: unknown, max: number, label: string): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new HttpError(400, `${label} must be text`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(400, `${label} must be ${max} characters or fewer`);
  return text;
}

export function reviewsRouter(db: DatabaseSync, opts: { now: () => Date }): Router {
  const router = Router();
  const insert = db.prepare('INSERT INTO reviews(rating, comment, name, created_at) VALUES (?, ?, ?, ?)');
  const latest = db.prepare(
    'SELECT rating, comment, name, created_at AS createdAt FROM reviews ORDER BY id DESC LIMIT 20',
  );
  const stats = db.prepare('SELECT COUNT(*) AS count, AVG(rating) AS average FROM reviews');

  router.post('/', (req, res) => {
    const rating = req.body?.rating;
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      throw new HttpError(400, 'Please choose a rating from 1 to 5');
    const comment = optionalText(req.body?.comment, 500, 'Comment');
    const name = optionalText(req.body?.name, 40, 'Name');
    insert.run(rating, comment, name, opts.now().toISOString());
    res.status(201).json({ ok: true });
  });

  router.get('/', (_req, res) => {
    const { count, average } = stats.get() as { count: number; average: number | null };
    res.json({
      average: average === null ? null : Math.round(average * 10) / 10,
      count,
      reviews: latest.all() as Review[],
    });
  });

  return router;
}
