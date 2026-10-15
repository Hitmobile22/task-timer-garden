import React, { useRef, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePhaseGate } from '@/hooks/usePhaseGate';
import { setTimerMuted } from '@/utils/phaseUtils';
import { PhaseProgressBadge } from './phase/PhaseProgressBadge';
import { MomentumDialog } from './phase/MomentumDialog';
import { supabase } from "@/integrations/supabase/client";
import { TimerControls } from './pomodoro/TimerControls';
import { usePomodoroSounds } from '@/hooks/usePomodoroSounds';
import { useTimerVisibility } from '@/hooks/useTimerVisibility';
import { LavaLampBackground } from './pomodoro/LavaLampBackground';
import { TimerDisplay } from './pomodoro/TimerDisplay';
import { SubtaskDisplay } from './pomodoro/SubtaskDisplay';
import { ProjectGoalDisplay } from './pomodoro/ProjectGoalDisplay';
import { usePomodoro } from '@/hooks/usePomodoro';
import { formatTime, setupFullscreenHandlers, restoreFullscreen } from '@/utils/timerUtils';
import { ProjectGoal } from '@/types/task.types';
import { useRecalculateProjectGoals } from '@/hooks/useRecalculateProjectGoals';

interface PomodoroTimerProps {
  tasks: string[];
  autoStart?: boolean;
  activeTaskId?: number;
  onShuffleTasks?: () => void;
  projectColor?: string;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  tasks: initialTasks,
  autoStart = false,
  activeTaskId,
  onShuffleTasks,
  projectColor
}) => {
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const recalculateProjectGoals = useRecalculateProjectGoals();
  
  const {
    timeLeft,
    isBreak,
    isRunning,
    setIsRunning,
    isFullscreen,
    setIsFullscreen,
    currentTask,
    getNextTask,
    currentSubtaskIndex,
    subtasks,
    completeSubtask,
    handleReset,
    shouldBeFullscreen,
    toggleFullscreen,
    requestFullscreenSafely,
    retryFullscreen,
    isTransitioning,
    getTodayTasks,
    activeTasks,
    isCountdownToNextTask
  } = usePomodoro(activeTaskId, autoStart);

  const { data: taskLists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('TaskLists')
        .select('*');
      
      if (error) throw error;
      return data || [];
    }
  });

  const { data: projectGoals = [], isSuccess: goalsLoaded } = useQuery({
    queryKey: ['project-goals', currentTask?.project_id],
    queryFn: async () => {
      if (!currentTask?.project_id) return [];
      
      const { data, error } = await supabase
        .from('project_goals')
        .select('*')
        .eq('project_id', currentTask.project_id)
        .eq('is_enabled', true);
      
      if (error) throw error;
      console.log(`Fetched ${data?.length || 0} goals for project ${currentTask.project_id}`);
      return data as ProjectGoal[];
    },
    enabled: !!currentTask?.project_id,
  });

  useEffect(() => {
    if (goalsLoaded && currentTask?.project_id && projectGoals.length > 0) {
      console.log(`Initial recalculating goals for project: ${currentTask.project_id}`);
      recalculateProjectGoals(currentTask.project_id);
    }
  }, [currentTask?.project_id, goalsLoaded, projectGoals.length, recalculateProjectGoals]);
  
  useEffect(() => {
    if (currentTask?.project_id && projectGoals.length > 0) {
      recalculateProjectGoals(currentTask.project_id);
      
      const intervalId = setInterval(() => {
        console.log(`Periodic recalculation for project: ${currentTask.project_id}`);
        recalculateProjectGoals(currentTask.project_id);
      }, 60000); // Recalculate every minute
      
      return () => clearInterval(intervalId);
    }
  }, [currentTask?.project_id, projectGoals.length, recalculateProjectGoals]);

  const isVisible = useTimerVisibility(currentTask, getNextTask, isCountdownToNextTask);
  
  const {
    isMuted,
    setIsMuted,
    soundSettings,
    setSoundSettings,
    availableSounds,
    playSound,
    previewSound
  } = usePomodoroSounds(isVisible);

  useEffect(() => {
    let tickInterval: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft !== null && !isBreak && !isMuted && isVisible && soundSettings.tick !== 'none') {
      setTimeout(() => {
        playSound('tick');
      }, 100);
      
      const tickDelay = 1000;

      const scheduleTick = () => {
        playSound('tick');
        tickInterval = setTimeout(scheduleTick, tickDelay);
      };
      
      tickInterval = setTimeout(scheduleTick, tickDelay);
    }

    return () => {
      if (tickInterval) {
        clearTimeout(tickInterval);
      }
    };
  }, [isRunning, isBreak, timeLeft, isMuted, isVisible, playSound, soundSettings.tick]);

  // ---- Phase system ----
  const queryClient = useQueryClient();
  const { states: phaseStates, phaseById } = usePhaseGate();
  const [momentumOpen, setMomentumOpen] = useState(false);
  const momentumShownFor = useRef<number | null>(null);
  useEffect(() => { setTimerMuted(isMuted); }, [isMuted]);
  const currentPhase = currentTask ? phaseById.get(currentTask.id) : undefined;
  const phaseState = currentTask?.project_id && currentPhase ? phaseStates.get(currentTask.project_id) : undefined;
  const upcoming = currentTask
    ? (getTodayTasks(activeTasks || []) as any[])
        .filter(t => t.id !== currentTask.id && t.date_started && new Date(t.date_started) >= new Date(currentTask.date_started || 0))
        .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime())
    : [];

  useEffect(() => {
    if (timeLeft !== 0 || isBreak || !currentTask || !currentPhase) return;
    if (momentumShownFor.current === currentTask.id) return;
    const unfinished = (subtasks || []).some((s: any) => s.Progress !== 'Completed');
    if (unfinished) { momentumShownFor.current = currentTask.id; setMomentumOpen(true); }
  }, [timeLeft, isBreak, currentTask, currentPhase, subtasks]);

  const refreshAfterMomentum = () => {
    setMomentumOpen(false);
    ['active-tasks', 'tasks', 'phased-tasks'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
  };
  const durOf = (t: any) => {
    if (t.date_started && t.date_due) return Math.max(5 * 60000, new Date(t.date_due).getTime() - new Date(t.date_started).getTime());
    return 25 * 60000;
  };
  const handleExtend = async () => {
    if (!currentTask) return;
    await supabase.from('Tasks').update({ date_due: new Date(Date.now() + 10 * 60000).toISOString() }).eq('id', currentTask.id);
    momentumShownFor.current = null;
    refreshAfterMomentum();
  };
  const handleMoveBehind = async (n: number) => {
    if (!currentTask) return;
    let cursor = Date.now();
    for (const t of upcoming.slice(0, n)) {
      const d = durOf(t);
      await supabase.from('Tasks').update({ date_started: new Date(cursor).toISOString(), date_due: new Date(cursor + d).toISOString() }).eq('id', t.id);
      cursor += d;
    }
    const d = durOf(currentTask);
    await supabase.from('Tasks').update({
      Progress: 'Not started', date_started: new Date(cursor).toISOString(), date_due: new Date(cursor + d).toISOString(),
    }).eq('id', currentTask.id);
    refreshAfterMomentum();
  };

  useEffect(() => {
    if (timeLeft === 0) {
      if (isBreak) {
        playSound('task');
      } else {
        playSound('break');
      }
    }
  }, [timeLeft, isBreak, playSound]);

  function handleToggleFullscreen() {
    toggleFullscreen(fullscreenContainerRef.current);
  }

  useEffect(() => {
    return setupFullscreenHandlers(setIsFullscreen, shouldBeFullscreen, isTransitioning);
  }, []);

  useEffect(() => {
    restoreFullscreen(
      requestFullscreenSafely, 
      setIsFullscreen, 
      shouldBeFullscreen, 
      fullscreenContainerRef.current
    );
  }, []);

  useEffect(() => {
    if (isTransitioning.current && shouldBeFullscreen.current && !document.fullscreenElement) {
      const delay = 800;

      const restoreTimeout = setTimeout(() => {
        requestFullscreenSafely(fullscreenContainerRef.current).then(success => {
          if (success) {
            setIsFullscreen(true);
          } else {
            retryFullscreen(fullscreenContainerRef.current);
          }
        });
      }, delay);
      
      return () => clearTimeout(restoreTimeout);
    }
  }, [isBreak, timeLeft]);

  if (!isVisible) return null;

  const currentSubtask = subtasks && subtasks.length > 0 ? subtasks[currentSubtaskIndex] : null;

  return (
    <div 
      ref={fullscreenContainerRef}
      className={`glass p-4 md:p-6 rounded-lg shadow-lg space-y-4 md:space-y-6 animate-slideIn w-full max-w-5xl mx-auto ${isFullscreen ? 'fixed inset-0 flex flex-col justify-center items-center z-50 max-w-none' : ''}`}
    >
      {isFullscreen && <LavaLampBackground 
        activeTaskId={activeTaskId || (currentTask?.id || undefined)} 
        taskLists={taskLists} 
        activeTasks={activeTasks} 
      />}

      <TimerDisplay 
        timeLeft={timeLeft}
        isBreak={isBreak}
        currentTask={currentTask}
        formatTime={formatTime}
        getNextTask={getNextTask}
        isCountdownToNextTask={isCountdownToNextTask}
        projectColor={projectColor}
      />

 {phaseState && <PhaseProgressBadge state={phaseState} />}

      <MomentumDialog
        open={momentumOpen}
        taskName={currentTask?.['Task Name'] || 'this task'}
        upcomingCount={upcoming.length}
        onExtend={handleExtend}
        onMoveBehind={handleMoveBehind}
        onLeave={() => setMomentumOpen(false)}
      />

      <SubtaskDisplay 
        currentSubtask={currentSubtask}
        onComplete={(subtaskId) => completeSubtask.mutate(subtaskId)}
      />

      <TimerControls
        isRunning={isRunning}
        setIsRunning={setIsRunning}
        isBreak={isBreak}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        handleReset={handleReset}
        playSound={playSound}
        previewSound={previewSound}
        soundSettings={soundSettings}
        setSoundSettings={setSoundSettings}
        availableSounds={availableSounds}
        onShuffleTasks={onShuffleTasks}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {projectGoals.length > 0 && (
        <ProjectGoalDisplay goals={projectGoals} />
      )}
    </div>
  );
};
