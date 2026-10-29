// @ts-ignore bun's built-in test runner (run with: bun test)
import { describe, it, expect } from 'bun:test';
import { estTodayWindow } from './estDayWindow';
describe('estTodayWindow', () => {
  it('daytime window ends at EST midnight, excluding tomorrow', () => {
    const w = estTodayWindow(new Date('2026-10-29T14:15:00Z')); // 10:15 AM EDT
    expect(w.start.toISOString()).toBe('2026-10-29T04:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-30T04:00:00.000Z');
  });
  it('evening window ends 3 AM EST next day', () => {
    const w = estTodayWindow(new Date('2026-10-30T02:00:00Z')); // 10 PM EDT
    expect(w.evening).toBe(true);
    expect(w.end.toISOString()).toBe('2026-10-30T07:00:00.000Z');
  });
});
