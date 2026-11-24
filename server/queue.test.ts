import { expect, test } from 'vitest';
import { dayKey, estimateWaitMinutes, isWithinNotifyWindow } from './queue.ts';

const now = new Date('2026-11-25T10:00:00');

test('waiting tokens add their full duration', () => {
  expect(estimateWaitMinutes([{ status: 'waiting', durationMin: 30, startedAt: null }, { status: 'waiting', durationMin: 15, startedAt: null }], now)).toBe(45);
});
test('the serving token adds only what is left', () => {
  expect(estimateWaitMinutes([{ status: 'serving', durationMin: 30, startedAt: '2026-11-25T09:50:00' }], now)).toBe(20);
});
test('an overrunning service adds zero, never negative', () => {
  expect(estimateWaitMinutes([{ status: 'serving', durationMin: 30, startedAt: '2026-11-25T09:00:00' }], now)).toBe(0);
});
test('empty queue is zero', () => expect(estimateWaitMinutes([], now)).toBe(0));
test('notify window is 15 minutes inclusive, waiting only', () => {
  expect(isWithinNotifyWindow('waiting', 15)).toBe(true);
  expect(isWithinNotifyWindow('waiting', 16)).toBe(false);
  expect(isWithinNotifyWindow('serving', 0)).toBe(false);
});
test('dayKey uses the local date', () => expect(dayKey(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05'));
