import { describe, expect, test } from 'bun:test';
import { computePhaseStates, isPhaseTaskUnlocked, paceFor, completedPhasesBetween } from './phaseUtils';

const t = (id: number, phase: number | null, Progress = 'Not started', h = id) =>
  ({ id, project_id: 1, phase, Progress, date_started: `2026-10-15T${String(h).padStart(2, '0')}:00:00Z` });

describe('phase system', () => {
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
});
