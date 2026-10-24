// Phase system: pure helpers for phased projects (no React, no Supabase).
export interface PhaseTask {
  id: number;
  project_id?: number | null;
  phase?: number | null;
  Progress?: string | null;
  date_started?: string | null;
  archived?: boolean | null;
}

export interface ProjectPhaseState {
  projectId: number;
  phases: number[];
  activePhase: number | null; // null = all phases done
  activeTotal: number;
  activeDone: number;
  /** Incomplete tasks in the active phase, in feed order. */
  queue: number[];
}

const byFeedOrder = (a: PhaseTask, b: PhaseTask) => {
  const da = a.date_started ? new Date(a.date_started).getTime() : Infinity;
  const db = b.date_started ? new Date(b.date_started).getTime() : Infinity;
  return da !== db ? da - db : a.id - b.id;
};

export function computePhaseStates(tasks: PhaseTask[]): Map<number, ProjectPhaseState> {
  const byProject = new Map<number, PhaseTask[]>();
  for (const t of tasks) {
    if (t.phase == null || t.project_id == null || t.archived) continue;
    if (!byProject.has(t.project_id)) byProject.set(t.project_id, []);
    byProject.get(t.project_id)!.push(t);
  }
  const out = new Map<number, ProjectPhaseState>();
  for (const [projectId, list] of byProject) {
    const phases = [...new Set(list.map(t => t.phase as number))].sort((a, b) => a - b);
    const activePhase = phases.find(p => list.some(t => t.phase === p && t.Progress !== 'Completed')) ?? null;
    const inActive = activePhase == null ? [] : list.filter(t => t.phase === activePhase);
    out.set(projectId, {
      projectId, phases, activePhase,
      activeTotal: inActive.length,
      activeDone: inActive.filter(t => t.Progress === 'Completed').length,
      queue: inActive.filter(t => t.Progress !== 'Completed').sort(byFeedOrder).map(t => t.id),
    });
  }
  return out;
}

/**
 * A task with unfinished subtasks is not done, even if its own Progress says Completed.
 * Returns task copies with Progress downgraded to 'Not started' where subtasks are incomplete.
 */
export function withSubtaskCompletion<T extends PhaseTask>(
  tasks: T[], subtasks: { 'Parent Task ID': number; Progress?: string | null }[]
): T[] {
  const incompleteParents = new Set<number>();
  for (const s of subtasks) {
    if (s.Progress !== 'Completed') incompleteParents.add(s['Parent Task ID']);
  }
  return tasks.map(t =>
    t.Progress === 'Completed' && incompleteParents.has(t.id) ? { ...t, Progress: 'Not started' } : t);
}

/** Daily pace for a project; defaults to 1 when unset or invalid. */
export function paceFor(recurringTaskCount?: number | null): number {
  return recurringTaskCount && recurringTaskCount > 0 ? recurringTaskCount : 1;
}

/** Recover only existing tasks in this project's current phase, never new placeholders. */
export function activePhaseRecoveryIds(tasks: PhaseTask[], subtasks: { 'Parent Task ID': number; Progress?: string | null }[], projectId: number, count?: number | null): number[] {
  const states = computePhaseStates(withSubtaskCompletion(tasks, subtasks));
  return states.get(projectId)?.queue.slice(0, paceFor(count)) ?? [];
}

/** Unphased tasks always pass. Phased tasks pass only if in the active phase and within the daily pace. */
export function isPhaseTaskUnlocked(
  task: PhaseTask, states: Map<number, ProjectPhaseState>, pace: (projectId: number) => number
): boolean {
  if (task.phase == null || task.project_id == null) return true;
  const s = states.get(task.project_id);
  if (!s) return true; // unknown yet: don't hide
  if (s.activePhase !== task.phase) return false;
  const idx = s.queue.indexOf(task.id);
  return idx !== -1 && idx < pace(task.project_id);
}

/** Timer selection fails closed for phased tasks until phase/subtask data is ready. */
export function filterPhaseTimerTasks<T extends PhaseTask>(
  tasks: T[], states: Map<number, ProjectPhaseState>, pace: (projectId: number) => number,
  phaseById: Map<number, PhaseTask>, ready: boolean,
): T[] {
  return tasks.filter(task => {
    const phased = phaseById.get(task.id) ?? task;
    if (phased.phase == null) return true;
    return ready && isPhaseTaskUnlocked(phased, states, pace);
  });
}

/** Phases whose completion just happened, comparing previous vs current active phase. */
export function completedPhasesBetween(prev: number | null | undefined, curr: ProjectPhaseState): number[] {
  if (prev == null) return [];
  const upper = curr.activePhase ?? Infinity;
  return curr.phases.filter(p => p >= prev && p < upper);
}

export function rewardFor(phaseRewards: unknown, phase: number): string | null {
  if (!phaseRewards || typeof phaseRewards !== 'object') return null;
  const v = (phaseRewards as Record<string, unknown>)[String(phase)];
  return typeof v === 'string' && v.trim() ? v : null;
}

// Shared mute flag so celebrations respect the Pomodoro mute button.
let timerMuted = true;
export const setTimerMuted = (m: boolean) => { timerMuted = m; };
export const isTimerMuted = () => timerMuted;

export function playLevelUpChime() {
  if (timerMuted) return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch { /* ignore */ }
}
