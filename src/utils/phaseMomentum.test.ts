// @ts-ignore bun's built-in test runner
import { describe, expect, test } from 'bun:test';
import { completeMomentumItems, needsPhaseMomentum } from './phaseMomentum';

describe('phased timer expiry', () => {
  test('phase 1 with all checked subtasks auto-completes without momentum', () => {
    expect(needsPhaseMomentum(1, [{ Progress: 'Completed' }, { Progress: 'Completed' }])).toBe(false);
  });
  test('phase 1 with an unfinished subtask requires momentum', () => {
    expect(needsPhaseMomentum(1, [{ Progress: 'Completed' }, { Progress: 'Not started' }])).toBe(true);
  });
  test('non-phased tasks keep normal expiry even with open subtasks', () => {
    expect(needsPhaseMomentum(null, [{ Progress: 'Not started' }])).toBe(false);
  });
  test('phased tasks with no subtasks auto-complete', () => {
    expect(needsPhaseMomentum(1, [])).toBe(false);
  });
  test('unknown subtask progress is unfinished', () => {
    expect(needsPhaseMomentum(2, [{ Progress: null }])).toBe(true);
  });
  test('complete all saves subtasks and then the task', async () => {
    const saved = { task: 'In progress', subtasks: ['Not started', 'Completed'] };
    await completeMomentumItems(async () => {
      saved.subtasks = saved.subtasks.map(() => 'Completed');
    }, async () => {
      expect(saved.subtasks).toEqual(['Completed', 'Completed']);
      saved.task = 'Completed';
    });
    expect(saved.task).toBe('Completed');
  });
  test('a failed subtask save does not complete the task', async () => {
    let taskCompleted = false;
    await expect(completeMomentumItems(async () => { throw new Error('Save failed'); }, async () => {
      taskCompleted = true;
    })).rejects.toThrow('Save failed');
    expect(taskCompleted).toBe(false);
  });
});