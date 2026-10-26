import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { supabase } from '@/integrations/supabase/client';
import {
  computePhaseStates, isPhaseTaskUnlocked, paceFor, completedPhasesBetween, rewardFor, PhaseTask,
  withSubtaskCompletion, filterPhaseTimerTasks,
} from '@/utils/phaseUtils';

const TZ = 'America/New_York';

export interface PhasedProject {
  id: number; 'Project Name': string; recurringTaskCount: number | null; phase_rewards: any;
}

export const PHASE_CELEBRATE_EVENT = 'phase-complete';
export interface PhaseCelebrationDetail { projectName: string; phase: number; reward: string | null; nextPhase: number | null; }

/** Loads phase data and exposes a filter that hides locked phased tasks from Today queues. */
export const usePhaseGate = () => {
  const { data: phasedTasks = [], isSuccess: tasksReady } = useQuery({
    queryKey: ['phased-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('Tasks')
        .select('id, project_id, phase, Progress, date_started, date_due, archived')
        .not('phase', 'is', null);
      if (error) throw error;
      return (data || []) as (PhaseTask & { date_due: string | null })[];
    },
    refetchInterval: 30000,
  });
  // A phased task only counts as done when its subtasks are done too.
  const phasedTaskIds = useMemo(() => phasedTasks.map(t => t.id), [phasedTasks]);
  const { data: phasedSubtasks = [], isSuccess: subtasksReady } = useQuery({
    queryKey: ['phased-subtasks', phasedTaskIds],
    enabled: phasedTaskIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('subtasks')
        .select('"Parent Task ID", Progress')
        .in('Parent Task ID', phasedTaskIds);
      if (error) throw error;
      return (data || []) as { 'Parent Task ID': number; Progress: string | null }[];
    },
    refetchInterval: 30000,
  });
  const gatedTasks = useMemo(
    () => withSubtaskCompletion(phasedTasks, phasedSubtasks),
    [phasedTasks, phasedSubtasks]);

  const projectIds = useMemo(
    () => [...new Set(phasedTasks.map(t => t.project_id).filter(Boolean))] as number[], [phasedTasks]);
  const { data: projects = [], isSuccess: projectsReady } = useQuery({
    queryKey: ['phased-projects', projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('Projects')
        .select('id, "Project Name", recurringTaskCount, phase_rewards').in('id', projectIds);
      if (error) throw error;
      return (data || []) as unknown as PhasedProject[];
    },
  });

  const states = useMemo(() => computePhaseStates(gatedTasks), [gatedTasks]);
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const pace = useCallback((pid: number) => paceFor(projectMap.get(pid)?.recurringTaskCount), [projectMap]);
  // Phase column may be missing on rows from older queries; look it up by id.
  const phaseById = useMemo(() => new Map(gatedTasks.map(t => [t.id, t])), [gatedTasks]);

  const filterUnlocked = useCallback(<T extends { id: number }>(tasks: T[]): T[] =>
    tasks.filter(task => {
      const p = phaseById.get(task.id);
      return !p || isPhaseTaskUnlocked(p, states, pace);
    }), [phaseById, states, pace]);

  const ready = tasksReady && (phasedTaskIds.length === 0 || subtasksReady)
    && (projectIds.length === 0 || projectsReady);
  const filterTimerUnlocked = useCallback(<T extends PhaseTask>(tasks: T[]): T[] =>
    filterPhaseTimerTasks(tasks, states, pace, phaseById, ready), [states, pace, phaseById, ready]);

  return { states, projectMap, phaseById, filterUnlocked, filterTimerUnlocked, pace, phasedTasks };
};

/** Runs on the timer page: feeds unlocked tasks into today and announces finished phases. */
export const usePhaseFeed = () => {
  const queryClient = useQueryClient();
  const { states, projectMap, phasedTasks, pace } = usePhaseGate();
  const busy = useRef(false);

  // Daily feed: unlocked tasks scheduled for a future day are pulled to now.
  useEffect(() => {
    if (busy.current || !phasedTasks.length || !projectMap.size) return;
    const nowZ = toZonedTime(new Date(), TZ);
    const dayEnd = new Date(nowZ); dayEnd.setDate(dayEnd.getDate() + (nowZ.getHours() >= 3 ? 1 : 0)); dayEnd.setHours(3, 0, 0, 0);
    const cutoff = fromZonedTime(dayEnd, TZ);
    const byId = new Map(phasedTasks.map(t => [t.id, t]));
    const toPull: any[] = [];
    for (const s of states.values()) {
      for (const id of s.queue.slice(0, pace(s.projectId))) {
        const t = byId.get(id)!;
        // Marked Completed but subtasks still open: it blocks the phase, so reopen it visibly.
        if (t.Progress === 'Completed' || !t.date_started || new Date(t.date_started) >= cutoff) toPull.push(t);
      }
    }
    if (!toPull.length) return;
    busy.current = true;
    (async () => {
      let cursor = new Date();
      for (const t of toPull) {
        const reopen = t.Progress === 'Completed';
        const keepDate = reopen && t.date_started && new Date(t.date_started) < cutoff;
        const dur = t.date_started && t.date_due
          ? Math.max(5 * 60000, new Date(t.date_due).getTime() - new Date(t.date_started).getTime()) : 25 * 60000;
        const start = new Date(cursor); const due = new Date(start.getTime() + dur);
        await supabase.from('Tasks').update({
          ...(keepDate ? {} : { date_started: start.toISOString(), date_due: due.toISOString() }),
          ...(reopen ? { Progress: 'In progress' } : {}),
        }).eq('id', t.id);
        if (reopen) {
          const name = projectMap.get(t.project_id as number)?.['Project Name'] ?? 'your project';
          toast.info(`A Phase ${t.phase} task in ${name} was reopened`, {
            description: 'It was marked complete, but some subtasks are still unchecked. Finish them to unlock the next phase.',
            duration: 10000,
          });
        }
        if (!keepDate) cursor = due;
      }

      busy.current = false;
      ['phased-tasks', 'active-tasks', 'tasks'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    })();
  }, [states, phasedTasks, projectMap, pace, queryClient]);

  // Celebrations: compare to the last active phase we saw for each project.
  useEffect(() => {
    if (!projectMap.size) return;
    for (const s of states.values()) {
      const key = `phase-seen-${s.projectId}`;
      const prevRaw = localStorage.getItem(key);
      const prev = prevRaw == null ? null : prevRaw === 'done' ? Infinity : Number(prevRaw);
      if (prev !== Infinity) {
        const project = projectMap.get(s.projectId);
        for (const phase of completedPhasesBetween(prev, s)) {
          window.dispatchEvent(new CustomEvent<PhaseCelebrationDetail>(PHASE_CELEBRATE_EVENT, {
            detail: {
              projectName: project?.['Project Name'] ?? 'Project', phase,
              reward: rewardFor(project?.phase_rewards, phase)
                ?? (s.activePhase == null ? rewardFor(project?.phase_rewards, 0) : null),
              nextPhase: s.activePhase,
            },
          }));
        }
      }
      localStorage.setItem(key, s.activePhase == null ? 'done' : String(s.activePhase));
    }
  }, [states, projectMap]);

  return { states, projectMap };
};
