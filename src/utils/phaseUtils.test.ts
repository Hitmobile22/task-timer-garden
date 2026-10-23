// @ts-ignore bun's built-in test runner (run with: bun test)
import { describe, expect, test } from 'bun:test';
import { computePhaseStates, isPhaseTaskUnlocked, paceFor, completedPhasesBetween, withSubtaskCompletion, filterPhaseTimerTasks } from './phaseUtils';

const t = (id: number, phase: number | null, Progress = 'Not started', h = id) =>
  ({ id, project_id: 1, phase, Progress, date_started: `2026-10-15T${String(h).padStart(2, '0')}:00:00Z` });

describe('phase system', () => {
  test('phase 4 cannot be timed while phase 2 is unfinished', () => {
    const rows = [t(1, 2), t(2, 4), t(3, null)];
    const states = computePhaseStates(rows);
    expect(filterPhaseTimerTasks(rows, states, () => 4, new Map(), true).map(t => t.id)).toEqual([1, 3]);
  });
  test('locked future phase is excluded from countdown candidates too', () => {
    const rows = [t(1, 2), t(2, 4)];
    expect(filterPhaseTimerTasks([rows[1]], computePhaseStates(rows), () => 4, new Map(), true)).toEqual([]);
  });
  test('phase timers wait for loading, while non-phased timers remain available', () => {
    const rows = [t(1, 2), t(2, null)];
    expect(filterPhaseTimerTasks(rows, new Map(), () => 4, new Map(), false).map(t => t.id)).toEqual([2]);
  });
  const tasks = [t(1, 1, 'Completed'), t(2, 1), t(3, 1), t(4, 2), t(5, null)];
  const states = computePhaseStates(tasks);

  test('active phase is the lowest phase with unfinished tasks', () => {
    expect(states.get(1)!.activePhase).toBe(1);
    expect(states.get(1)!.activeDone).toBe(1);
    expect(states.get(1)!.activeTotal).toBe(3);
  });

  test('later phase tasks stay locked until earlier phase is done', () => {
    expect(isPhaseTaskUnlocked(tasks[3], states, () => 5)).toBe(false);
  });

  test('daily pace limits how many active-phase tasks show', () => {
    expect(isPhaseTaskUnlocked(tasks[1], states, () => 1)).toBe(true);
    expect(isPhaseTaskUnlocked(tasks[2], states, () => 1)).toBe(false);
  });

  test('dependable pool (no phase) is never hidden', () => {
    expect(isPhaseTaskUnlocked(tasks[4], states, () => 1)).toBe(true);
  });

  test('pace defaults to 1', () => {
    expect(paceFor(null)).toBe(1);
    expect(paceFor(3)).toBe(3);
  });

  test('finishing phase 1 unlocks phase 2 and reports completion', () => {
    const next = computePhaseStates([t(1, 1, 'Completed'), t(2, 1, 'Completed'), t(4, 2)]);
    expect(next.get(1)!.activePhase).toBe(2);
    expect(completedPhasesBetween(1, next.get(1)!)).toEqual([1]);
  });

  test('a completed task with unfinished subtasks does not advance the phase', () => {
    const base = [t(1, 1, 'Completed'), t(2, 1, 'Completed'), t(4, 2)];
    const subs = [{ 'Parent Task ID': 2, Progress: 'Not started' }];
    const gated = withSubtaskCompletion(base, subs);
    const next = computePhaseStates(gated);
    expect(next.get(1)!.activePhase).toBe(1);
    expect(isPhaseTaskUnlocked(gated[2], next, () => 5)).toBe(false);
  });

  test('a completed task with all subtasks done advances the phase', () => {
    const base = [t(1, 1, 'Completed'), t(2, 1, 'Completed'), t(4, 2)];
    const subs = [{ 'Parent Task ID': 2, Progress: 'Completed' }];
    const next = computePhaseStates(withSubtaskCompletion(base, subs));
    expect(next.get(1)!.activePhase).toBe(2);
  });
});
