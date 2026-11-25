import fs from 'node:fs';
import { createApp } from './app.ts';
import { openDb } from './db.ts';
import { createEuronEditor } from './hairEdit.ts';

// Local settings; on the server the same names are set as environment variables.
if (fs.existsSync('.env')) process.loadEnvFile('.env');

fs.mkdirSync('data', { recursive: true });
const db = openDb('data/salon.db');
const euronKey = process.env.EURI_API_KEY;
const app = createApp(db, {
  staffPin: process.env.STAFF_PIN ?? '1234',
  staticDir: fs.existsSync('dist/index.html') ? 'dist' : undefined,
  hairEditor: euronKey ? createEuronEditor({ apiKey: euronKey }) : undefined,
});
const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log(`Salon server on http://localhost:${port}`);
});
