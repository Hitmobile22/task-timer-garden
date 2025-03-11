import React, { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { TimerControls } from './pomodoro/TimerControls';
import { usePomodoroSounds } from '@/hooks/usePomodoroSounds';
import { useTimerVisibility } from '@/hooks/useTimerVisibility';
import { Maximize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Subtask } from '@/types/task.types';
import { LavaLampBackground } from './pomodoro/LavaLampBackground';
import { isTaskTimeBlock, isTaskInFuture } from '@/utils/taskUtils';

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
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isBreak, setIsBreak] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSubtaskIndex, setCurrentSubtaskIndex] = useState(0);
  const timerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const subtaskTextRef = useRef<HTMLDivElement>(null);
  const { data: activeTasks } = useQuery({
    queryKey: ['active-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .in('Progress', ['Not started', 'In progress'])
        .neq('Progress', 'Backlog')
        .order('date_started', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
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

  const currentTask = activeTaskId
    ? activeTasks?.find(t => t.id === activeTaskId && !isTaskInFuture(t) && t.Progress !== 'Backlog')
    : activeTasks?.find(t => (t.Progress === 'In progress' || t.Progress === 'Not started') && !isTaskInFuture(t) && t.Progress !== 'Backlog');

  const { data: subtasks } = useQuery({
    queryKey: ['subtasks', currentTask?.id],
    queryFn: async () => {
      if (!currentTask?.id) return [];

      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('Parent Task ID', currentTask.id)
        .neq('Progress', 'Completed')
        .order('id', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentTask?.id,
  });

  useEffect(() => {
    if (subtasks && subtasks.length > 0) {
      const interval = setInterval(() => {
        setCurrentSubtaskIndex(prev => (prev + 1) % subtasks.length);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [subtasks]);

  useEffect(() => {
    if (subtaskTextRef.current) {
      const textElement = subtaskTextRef.current;
      textElement.scrollLeft = 0;

      if (textElement.scrollWidth > textElement.clientWidth) {
        const scrollDuration = 8000;
        const scrollStep = textElement.scrollWidth / (scrollDuration / 20);
        let scrollPosition = 0;

        const scrollAnimation = setInterval(() => {
          scrollPosition += scrollStep;
          if (scrollPosition >= textElement.scrollWidth - textElement.clientWidth) {
            clearInterval(scrollAnimation);
            setTimeout(() => {
              textElement.scrollLeft = 0;
            }, 2000);
          } else {
            textElement.scrollLeft = scrollPosition;
          }
        }, 20);

        return () => clearInterval(scrollAnimation);
      }
    }
  }, [currentSubtaskIndex, subtasks]);

  const completeSubtask = useMutation({
    mutationFn: async (subtaskId: number) => {
      const { error } = await supabase
        .from('subtasks')
        .update({ Progress: 'Completed' })
        .eq('id', subtaskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Subtask completed');
    },
  });

  const getNextTask = () => {
    if (!activeTasks || activeTasks.length === 0) return null;

    const now = new Date();
    return activeTasks.find(task => {
      if (task.Progress === 'Backlog' || isTaskInFuture(task)) return false;
      
      const startTime = new Date(task.date_started);
      const timeDiff = startTime.getTime() - now.getTime();
      return timeDiff > 0 && timeDiff <= 10 * 60 * 1000;
    });
  };

  const calculateTimeLeft = (task: any) => {
    if (!task || !task.date_due) return 25 * 60;

    const now = new Date();
    const dueTime = new Date(task.date_due);
    const diffInSeconds = Math.floor((dueTime.getTime() - now.getTime()) / 1000);

    if (diffInSeconds <= 0 || diffInSeconds > 25 * 60) {
      return 25 * 60;
    }

    return diffInSeconds;
  };

  const getTodayTasks = (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return [];

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrow5AM = new Date(tomorrow);
    tomorrow5AM.setHours(5, 0, 0, 0);

    const nonBacklogTasks = tasks.filter(task => task.Progress !== 'Backlog');

    if (now.getHours() >= 21) {
      return nonBacklogTasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        return taskDate >= today && taskDate <= tomorrow5AM;
      });
    } else {
      return nonBacklogTasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        return taskDate >= today && taskDate < tomorrow;
      });
    }
  };

  useEffect(() => {
    if (currentTask && !isBreak) {
      const remaining = calculateTimeLeft(currentTask);
      setTimeLeft(remaining);
    } else if (isBreak) {
      setTimeLeft(5 * 60);
    }
  }, [currentTask, isBreak]);

  const updateTaskProgress = useMutation({
    mutationFn: async (taskId: number) => {
      const taskToComplete = activeTasks?.find(t => t.id === taskId);
      if (!taskToComplete || taskToComplete.Progress === 'Backlog' || isTaskInFuture(taskToComplete)) {
        throw new Error("Cannot complete a backlog or future task");
      }
      
      const { error } = await supabase
        .from('Tasks')
        .update({ Progress: 'Completed' })
        .eq('id', taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task completed');
    },
    onError: (error) => {
      console.error('Error completing task:', error);
      toast.error('Cannot complete this task - it may be in backlog or scheduled for a future date');
    }
  });

  const resetTaskSchedule = useMutation({
    mutationFn: async () => {
      if (!activeTasks || activeTasks.length === 0 || !currentTask) {
        return;
      }

      const todayTasks = getTodayTasks(activeTasks);
      if (todayTasks.length === 0) {
        return;
      }

      const currentTime = new Date();
      const currentTaskEndTime = new Date(currentTime.getTime() + 25 * 60 * 1000);

      await supabase
        .from('Tasks')
        .update({
          Progress: 'In progress',
          date_started: currentTime.toISOString(),
          date_due: currentTaskEndTime.toISOString()
        })
        .eq('id', currentTask.id);

      const remainingTasks = todayTasks
        .filter(t => t.Progress !== 'Completed' && t.id !== currentTask.id)
        .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime());

      let nextStartTime = new Date(currentTaskEndTime.getTime() + 5 * 60 * 1000);

      for (const task of remainingTasks) {
        const taskEndTime = new Date(nextStartTime.getTime() + 25 * 60 * 1000);

        await supabase
          .from('Tasks')
          .update({
            Progress: 'Not started',
            date_started: nextStartTime.toISOString(),
            date_due: taskEndTime.toISOString()
          })
          .eq('id', task.id);

        nextStartTime = new Date(taskEndTime.getTime() + 5 * 60 * 1000);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Timer and task schedule reset');
    },
    onError: (error) => {
      console.error('Error resetting schedule:', error);
      toast.error('Failed to reset task schedule');
    }
  });

  const isVisible = useTimerVisibility(currentTask, getNextTask);
  const {
    isMuted,
    setIsMuted,
    soundSettings,
    setSoundSettings,
    availableSounds,
    playSound
  } = usePomodoroSounds(isVisible);

  useEffect(() => {
    if ((autoStart || activeTaskId) && activeTasks && activeTasks.length > 0 && !isRunning) {
      const validTaskExists = activeTasks.some(t => 
        t.Progress !== 'Backlog' && !isTaskInFuture(t)
      );
      
      if (validTaskExists) {
        setIsRunning(true);
        toast.info("Timer started automatically");
      }
    }
  }, [autoStart, activeTaskId, activeTasks?.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft !== null) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (!prev || prev <= 1) {
            if (isBreak) {
              setIsBreak(false);
              playSound('task');
              toast.success("Break finished! Starting next task.");
              return calculateTimeLeft(currentTask);
            } else if (currentTask) {
              if (currentTask.Progress !== 'Backlog' && !isTaskInFuture(currentTask)) {
                updateTaskProgress.mutate(currentTask.id);
                setIsBreak(true);
                playSound('break');
                toast.success("Work session complete! Time for a break.");
                return 5 * 60;
              } else {
                toast.error("Cannot complete this task - it's in backlog or scheduled for the future");
                setIsRunning(false);
                return prev;
              }
            }
          } else if (!isBreak) {
            playSound('tick');
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, currentTask, isBreak, timeLeft, playSound]);

  const handleReset = () => {
    if (!currentTask) {
      toast.error("No active task to reset");
      return;
    }

    if (!isBreak) {
      setTimeLeft(25 * 60);
    } else {
      setTimeLeft(5 * 60);
      setIsBreak(false);
    }

    resetTaskSchedule.mutate();

    setIsRunning(true);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = timeLeft === null ? 0 : isBreak
    ? ((5 * 60 - timeLeft) / (5 * 60)) * 100
    : ((25 * 60 - timeLeft) / (25 * 60)) * 100;

  const getTimerColor = () => {
    if (isBreak) {
      return 'linear-gradient(184.1deg, rgba(249,255,182,1) 44.7%, rgba(226,255,172,1) 67.2%)';
    }

    const progress = timeLeft === null ? 0 : ((25 * 60 - timeLeft) / (25 * 60)) * 100;
    const colors = {
      start: {
        hue: 150,
        saturation: 85,
        lightness: 45
      },
      end: {
        hue: 200,
        saturation: 70,
        lightness: 70
      }
    };

    const currentHue = colors.start.hue + (progress * (colors.end.hue - colors.start.hue) / 100);
    const currentSaturation = colors.start.saturation + (progress * (colors.end.saturation - colors.start.saturation) / 100);
    const currentLightness = colors.start.lightness + (progress * (colors.end.lightness - colors.start.lightness) / 100);

    return `linear-gradient(109.6deg, hsl(${currentHue}, ${currentSaturation}%, ${currentLightness}%) 11.2%, hsl(${currentHue + 10}, ${currentSaturation - 10}%, ${currentLightness + 5}%) 91.1%)`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (timerRef.current?.requestFullscreen) {
        timerRef.current.requestFullscreen()
          .then(() => {
            setIsFullscreen(true);
            console.log("Entered fullscreen mode");
          })
          .catch(err => console.error(`Error attempting to enable fullscreen: ${err.message}`));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => {
            setIsFullscreen(false);
            console.log("Exited fullscreen mode");
          })
          .catch(err => console.error(`Error attempting to exit fullscreen: ${err.message}`));
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const shouldRestoreFullscreen = localStorage.getItem('pomodoroFullscreen') === 'true';
    
    if (shouldRestoreFullscreen && !document.fullscreenElement && timerRef.current) {
      try {
        timerRef.current.requestFullscreen()
          .then(() => setIsFullscreen(true))
          .catch(err => {
            console.error(`Error restoring fullscreen: ${err.message}`);
            localStorage.removeItem('pomodoroFullscreen');
          });
      } catch (err) {
        console.error(`Error attempting to restore fullscreen: ${err}`);
        localStorage.removeItem('pomodoroFullscreen');
      }
    }
    
    return () => {
      // Don't remove the storage key on every unmount, only when explicitly exiting
    };
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      localStorage.setItem('pomodoroFullscreen', 'true');
    } else if (localStorage.getItem('pomodoroFullscreen') === 'true') {
      localStorage.removeItem('pomodoroFullscreen');
    }
  }, [isFullscreen]);

  if (!isVisible) return null;

  const currentSubtask = subtasks && subtasks.length > 0 ? subtasks[currentSubtaskIndex] : null;

  const getSubtaskColor = () => {
    const colors = [
      "text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500",
      "text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-500",
      "text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500",
      "text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-500",
      "text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 to-pink-600"
    ];

    const index = currentSubtask ? currentSubtask.id % colors.length : 0;
    return colors[index];
  };

  return (
    <div
      ref={timerRef}
      className={`glass p-4 md:p-6 rounded-lg shadow-lg space-y-4 md:space-y-6 animate-slideIn w-full max-w-5xl mx-auto ${isFullscreen ? 'fixed inset-0 flex flex-col justify-center items-center z-50 max-w-none' : ''}`}
    >
      {isFullscreen && <LavaLampBackground 
        activeTaskId={activeTaskId || (currentTask?.id || undefined)} 
        taskLists={taskLists} 
        activeTasks={activeTasks} 
      />}

      <div className="space-y-2 w-full">
        <h2 className="text-2xl font-semibold text-primary">
          {isBreak ? 'Break Time' : 'Work Session'}
        </h2>
        {currentTask && !isBreak && (
          <p className="text-primary/80">
            Working on: {currentTask["Task Name"]}
          </p>
        )}
        {isBreak && getNextTask() && (
          <p className="text-primary/80">
            Next up: {getNextTask()?.["Task Name"]}
          </p>
        )}
      </div>

      {currentSubtask && (
        <div className="absolute top-4 right-4 animate-fadeIn max-w-[300px] sm:max-w-xs mx-auto">
          <div
            ref={subtaskTextRef}
            className={`font-medium text-right whitespace-nowrap overflow-hidden cursor-pointer ${getSubtaskColor()} hover:opacity-80 transition-opacity`}
            onClick={() => completeSubtask.mutate(Number(currentSubtask.id))}
            title="Click to mark as completed"
          >
            {currentSubtask["Task Name"]}
          </div>
        </div>
      )}

      <div
        className="relative p-6 md:p-8 rounded-xl transition-all duration-300 shadow-lg mx-auto w-full"
        style={{
          background: getTimerColor(),
        }}
      >
        <span className="text-4xl md:text-5xl font-mono font-bold text-primary text-center block">
          {timeLeft !== null ? formatTime(timeLeft) : '25:00'}
        </span>
      </div>

      <Progress
        value={progress}
        className="h-2 w-full"
      />

      <TimerControls
        isRunning={isRunning}
        setIsRunning={setIsRunning}
        isBreak={isBreak}
        isMuted={isMuted}
        setIsMuted={setIsMuted}
        handleReset={handleReset}
        playSound={playSound}
        soundSettings={soundSettings}
        setSoundSettings={setSoundSettings}
        availableSounds={availableSounds}
        onShuffleTasks={onShuffleTasks}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />
    </div>
  );
};

