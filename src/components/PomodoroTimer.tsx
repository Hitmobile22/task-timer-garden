
import React, { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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

interface PomodoroTimerProps {
  tasks: string[];
  autoStart?: boolean;
  activeTaskId?: number;
  onShuffleTasks?: () => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  tasks: initialTasks,
  autoStart = false,
  activeTaskId,
  onShuffleTasks
}) => {
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  
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

  const { data: projectGoals = [] } = useQuery({
    queryKey: ['project-goals', currentTask?.project_id],
    queryFn: async () => {
      if (!currentTask?.project_id) return [];
      
      const { data, error } = await supabase
        .from('project_goals')
        .select('*')
        .eq('project_id', currentTask.project_id)
        .eq('is_enabled', true);
      
      if (error) throw error;
      return data as ProjectGoal[];
    },
    enabled: !!currentTask?.project_id,
  });

  // Enhanced visibility check to include upcoming task countdown
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

  // Play tick sound at regular intervals when timer is running
  useEffect(() => {
    let tickInterval: NodeJS.Timeout | null = null;

    if (isRunning && timeLeft !== null && !isBreak && !isMuted && isVisible && soundSettings.tick !== 'none') {
      console.log("Setting up tick sound interval");
      
      // Force an immediate tick sound when starting
      setTimeout(() => {
        console.log("Playing initial tick sound");
        playSound('tick');
      }, 100);
      
      // Create a precise interval for consistent tick sounds
      const tickDelay = 1000; // 1 second between ticks
      
      const scheduleTick = () => {
        playSound('tick');
        tickInterval = setTimeout(scheduleTick, tickDelay);
      };
      
      // Start the scheduled ticks
      tickInterval = setTimeout(scheduleTick, tickDelay);
    }

    return () => {
      if (tickInterval) {
        clearTimeout(tickInterval);
      }
    };
  }, [isRunning, isBreak, timeLeft, isMuted, isVisible, playSound, soundSettings.tick]);

  // Handle task completion and break sounds
  useEffect(() => {
    if (timeLeft === 0) {
      if (isBreak) {
        playSound('task');
      } else {
        playSound('break');
      }
    }
  }, [timeLeft, isBreak, playSound]);

  // Handle fullscreen toggling
  const handleToggleFullscreen = () => {
    toggleFullscreen(fullscreenContainerRef.current);
  };

  // Setup fullscreen change listener
  useEffect(() => {
    return setupFullscreenHandlers(setIsFullscreen, shouldBeFullscreen, isTransitioning);
  }, []);

  // Restore fullscreen if it was active before
  useEffect(() => {
    restoreFullscreen(
      requestFullscreenSafely, 
      setIsFullscreen, 
      shouldBeFullscreen, 
      fullscreenContainerRef.current
    );
  }, []);

  // Handle fullscreen restoration after transitions
  useEffect(() => {
    if (isTransitioning.current && shouldBeFullscreen.current && !document.fullscreenElement) {
      const delay = 800; // Increased delay for better chance of success
      
      const restoreTimeout = setTimeout(() => {
        console.log("Attempting to restore fullscreen after transition");
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
