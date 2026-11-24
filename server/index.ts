import fs from 'node:fs';
import { createApp } from './app.ts';
import { openDb } from './db.ts';

fs.mkdirSync('data', { recursive: true });
const db = openDb('data/salon.db');
const app = createApp(db, {
  staffPin: process.env.STAFF_PIN ?? '1234',
  staticDir: fs.existsSync('dist/index.html') ? 'dist' : undefined,
});
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Salon server on http://localhost:${port}`);
});
