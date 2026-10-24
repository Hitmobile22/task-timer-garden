import type { Task } from '@/types/task.types';

/** Keep bulk writes inside the currently displayed, explicitly selected tasks. */
export function selectedTaskIds(tasks: Task[], selected: number[]): number[] {
  const ids = new Set(selected);
  return tasks.filter(t => ids.has(t.id)).map(t => t.id);
}

export function phasedDateClearIds(tasks: Task[], selected: number[]): number[] {
  const ids = new Set(selected);
  return tasks.filter(t => ids.has(t.id) && t.phase != null).map(t => t.id);
}