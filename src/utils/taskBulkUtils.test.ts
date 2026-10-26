// @ts-ignore Bun's built-in test runner
import { expect, test } from 'bun:test';
import { selectedTaskIds, phasedDateClearIds } from './taskBulkUtils';
import type { Task } from '@/types/task.types';

const rows: Task[] = [
  { id: 1, 'Task Name': 'Phase task', Progress: 'Not started', task_list_id: 1, phase: 3 },
  { id: 2, 'Task Name': 'Ordinary task', Progress: 'In progress', task_list_id: 1 },
];
test('bulk edits exclude selected tasks no longer in the displayed set', () => {
  expect(selectedTaskIds(rows, [1, 2, 99])).toEqual([1, 2]);
  expect(selectedTaskIds([rows[1]], [1])).toEqual([]);
});
test('bulk date clearing only affects selected phased tasks, not ordinary tasks', () => {
  expect(phasedDateClearIds(rows, [1, 2])).toEqual([1]);
  expect(phasedDateClearIds(rows, [2])).toEqual([]);
});