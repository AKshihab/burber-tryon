import express from 'express';
import type { Express, NextFunction, Request, Response } from 'express';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { authRouter } from './auth.ts';
import type { HairEditor } from './hairEdit.ts';
import { HttpError } from './http.ts';
import { looksRouter } from './looks.ts';
import { reviewsRouter } from './reviews.ts';
import { tokensRouter } from './tokens.ts';

export { HttpError };

export type AppOptions = {
  staffPin: string;
  now?: () => Date;
  staticDir?: string;
  /** Makes the haircut pictures; without it that feature is switched off. */
  hairEditor?: HairEditor;
  sleep?: (ms: number) => Promise<void>;
};

export function createApp(db: DatabaseSync, opts: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '20kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/services', (_req, res) => {
    const services = db
      .prepare('SELECT id, name, category, price, duration_min AS durationMin FROM services ORDER BY id')
      .all();
    res.json({ services });
  });

  const now = opts.now ?? (() => new Date());

  app.use('/api/auth', authRouter(db));
  app.use('/api/reviews', reviewsRouter(db, { now }));
  app.use('/api/looks', looksRouter(db, { now, editor: opts.hairEditor, sleep: opts.sleep }));
  app.use('/api', tokensRouter(db, { staffPin: opts.staffPin, now }));

  app.use('/api', (_req, _res, next) => {
    next(new HttpError(404, 'Not found'));
  });

  if (opts.staticDir) {
    const dir = path.resolve(opts.staticDir);
    app.use(express.static(dir));
    // Page addresses (/review, /staff ...) get the app shell; a missing file is a real 404.
    app.get(/.*/, (req, res) => {
      if (path.extname(req.path)) throw new HttpError(404, 'Not found');
      res.sendFile(path.join(dir, 'index.html'));
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { status?: number; statusCode?: number; message?: string };
    const status = e.status ?? e.statusCode ?? 500;
    if (err instanceof HttpError || (status >= 400 && status < 500)) {
      const other = status === 413 ? 'That file is too large' : 'Bad request';
      const message = err instanceof HttpError ? err.message : other;
      res.status(status).json({ error: message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  return app;
}
