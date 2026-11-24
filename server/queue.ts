export const NOTIFY_WINDOW_MIN = 15;

export type AheadToken = { status: 'waiting' | 'serving'; durationMin: number; startedAt: string | null };

export function estimateWaitMinutes(ahead: AheadToken[], now: Date): number {
  let total = 0;
  for (const t of ahead) {
    if (t.status === 'serving' && t.startedAt) {
      const elapsedMinutes = (now.getTime() - new Date(t.startedAt).getTime()) / 60000;
      total += Math.max(0, Math.ceil(t.durationMin - elapsedMinutes));
    } else {
      total += t.durationMin;
    }
  }
  return total;
}

export function isWithinNotifyWindow(status: string, etaMinutes: number): boolean {
  return status === 'waiting' && etaMinutes <= NOTIFY_WINDOW_MIN;
}

export function dayKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
