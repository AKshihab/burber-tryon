import { KEYS, local } from './storage.ts';

export type User = { id: number; name: string; phone: string | null; isGuest: boolean };
export type Service = { id: number; name: string; category: string; price: number; durationMin: number };
export type TokenStatus = 'waiting' | 'serving' | 'done' | 'cancelled';
export type TokenView = {
  number: number;
  status: TokenStatus;
  serviceName: string;
  hairstyleKey: string | null;
  aheadCount: number;
  etaMinutes: number;
  notifySoon: boolean;
};
export type Review = { rating: number; comment: string; name: string; createdAt: string };
export type StaffToken = {
  number: number;
  status: TokenStatus;
  customerName: string;
  serviceName: string;
  hairstyleKey: string | null;
};

export type LookView = {
  id: string;
  status: 'waiting' | 'working' | 'done' | 'failed';
  ahead: number;
  styleKey: string;
};

export const CURRENCY = '৳';
export const formatPrice = (n: number): string => `${CURRENCY}${n}`;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type ApiInit = { method?: string; body?: unknown; headers?: Record<string, string> };

async function send(path: string, init: ApiInit): Promise<Response> {
  const headers: Record<string, string> = { ...init.headers };
  let body: string | Blob | undefined;
  if (init.body instanceof Blob) {
    headers['Content-Type'] = init.body.type;
    body = init.body;
  } else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }
  const token = local.get(KEYS.session);
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, { method: init.method ?? 'GET', headers, body });
  } catch {
    throw new ApiError(0, 'Could not reach the salon. Check your connection and try again.');
  }
  if (!res.ok) {
    const data = await readJson(res);
    const message = (data as { error?: unknown } | null)?.error;
    throw new ApiError(res.status, typeof message === 'string' ? message : 'Something went wrong');
  }
  return res;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null; // not JSON
  }
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  return (await readJson(await send(path, init))) as T;
}

/** Fetch a picture that needs the customer's session. */
export async function apiBlob(path: string): Promise<Blob> {
  return (await send(path, {})).blob();
}

export const errorMessage = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : 'Something went wrong';
