import { estTodayWindow } from './estDayWindow';

export const DEFAULT_TASK_LIST_ID = 1;
export const STICKY_TASK_MINUTES = 25;

type Slotted = { date_started?: string | null; date_due?: string | null; Progress?: string | null };

/** Next free start time today (EST window): after now and after the last open task that ends later today. */
export function nextOpenSlot(tasks: Slotted[], now: Date = new Date()): Date {
  const { end } = estTodayWindow(now);
  let cursor = now.getTime();
  for (const t of tasks) {
    if (t.Progress === 'Completed' || !t.date_due || !t.date_started) continue;
    const s = new Date(t.date_started).getTime();
    const d = new Date(t.date_due).getTime();
    if (s >= end.getTime()) continue; // future day: never counts
    if (d > cursor) cursor = d;
  }
  return new Date(cursor);
}

export function stickyTaskListId(projectListId?: number | null): number {
  return projectListId ?? DEFAULT_TASK_LIST_ID;
}
