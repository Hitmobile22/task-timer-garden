// @ts-ignore bun's built-in test runner (run with: bun test)
import { describe, it, expect } from 'bun:test';
import { nextOpenSlot, stickyTaskListId } from './stickyQueue';

const now = new Date('2026-11-17T16:00:00Z'); // 11 AM EST
describe('sticky queue', () => {
  it('starts now when the queue is empty', () => {
    expect(nextOpenSlot([], now).toISOString()).toBe(now.toISOString());
  });
  it('goes after the last open task today', () => {
    const t = [{ date_started: '2026-11-17T16:00:00Z', date_due: '2026-11-17T17:30:00Z', Progress: 'Not started' }];
    expect(nextOpenSlot(t, now).toISOString()).toBe('2026-11-17T17:30:00.000Z');
  });
  it('ignores tasks on future days and completed tasks', () => {
    const t = [
      { date_started: '2026-11-18T14:00:00Z', date_due: '2026-11-18T15:00:00Z', Progress: 'Not started' },
      { date_started: '2026-11-17T16:00:00Z', date_due: '2026-11-17T18:00:00Z', Progress: 'Completed' },
    ];
    expect(nextOpenSlot(t, now).toISOString()).toBe(now.toISOString());
  });
  it('unlinked notes go to the Default list', () => {
    expect(stickyTaskListId(null)).toBe(1);
    expect(stickyTaskListId(16)).toBe(16);
  });
});
