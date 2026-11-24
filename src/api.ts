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

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...init.headers };
  let body: string | undefined;
  if (init.body !== undefined) {
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
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const message = (data as { error?: unknown } | null)?.error;
    throw new ApiError(res.status, typeof message === 'string' ? message : 'Something went wrong');
  }
  return data as T;
}

export const errorMessage = (e: unknown): string =>
  e instanceof Error && e.message ? e.message : 'Something went wrong';
