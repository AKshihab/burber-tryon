import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT UNIQUE, password_hash TEXT, is_guest INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, duration_min INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(id INTEGER PRIMARY KEY, day TEXT NOT NULL, number INTEGER NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id), service_id INTEGER NOT NULL REFERENCES services(id), hairstyle_key TEXT, status TEXT NOT NULL, created_at TEXT NOT NULL, started_at TEXT, UNIQUE(day, number));
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, rating INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
`;

const SEED_SERVICES: [string, string, number, number][] = [
  ['Haircut', 'Hair', 300, 30],
  ['Beard trim', 'Beard', 150, 15],
  ['Haircut + beard', 'Hair', 400, 40],
  ['Hair wash & style', 'Care', 250, 20],
  ['Hair colour', 'Hair', 1200, 60],
  ['Head massage', 'Care', 200, 15],
];

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM services').get() as { n: number };
  if (n === 0) {
    const insert = db.prepare('INSERT INTO services(name, category, price, duration_min) VALUES (?, ?, ?, ?)');
    for (const row of SEED_SERVICES) insert.run(...row);
  }
  return db;
}
