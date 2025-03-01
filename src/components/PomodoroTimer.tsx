
import React, { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { TimerControls } from './pomodoro/TimerControls';
import { usePomodoroSounds } from '@/hooks/usePomodoroSounds';
import { useTimerVisibility } from '@/hooks/useTimerVisibility';

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
  const queryClient = useQueryClient();

  const { data: activeTasks } = useQuery({
    queryKey: ['active-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .neq('Progress', 'Completed')
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const currentTask = activeTaskId 
    ? activeTasks?.find(t => t.id === activeTaskId)
    : activeTasks?.find(t => t.Progress === 'In progress' || t.Progress === 'Not started');

  const getNextTask = () => {
    if (!activeTasks || activeTasks.length === 0) return null;
    
    const now = new Date();
    return activeTasks.find(task => {
      const startTime = new Date(task.date_started);
      const timeDiff = startTime.getTime() - now.getTime();
      return timeDiff > 0 && timeDiff <= 10 * 60 * 1000;
    });
  };

  const calculateTimeLeft = (task: any) => {
    if (!task || !task.date_due) return 25 * 60; // Default to 25 minutes if no due date
    
    const now = new Date();
    const dueTime = new Date(task.date_due);
    const diffInSeconds = Math.floor((dueTime.getTime() - now.getTime()) / 1000);
    
    // If less than 0 seconds left or more than 25 minutes, default to 25 minutes
    if (diffInSeconds <= 0 || diffInSeconds > 25 * 60) {
      return 25 * 60;
    }
    
    return diffInSeconds;
  };

  useEffect(() => {
    if (currentTask && !isBreak) {
      const remaining = calculateTimeLeft(currentTask);
      setTimeLeft(remaining);
    } else if (isBreak) {
      setTimeLeft(5 * 60); // 5 minutes for break
    }
  }, [currentTask, isBreak]);

  const updateTaskProgress = useMutation({
    mutationFn: async (taskId: number) => {
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
      setIsRunning(true);
      toast.info("Timer started automatically");
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
              updateTaskProgress.mutate(currentTask.id);
              setIsBreak(true);
              playSound('break');
              toast.success("Work session complete! Time for a break.");
              return 5 * 60;
            }
          } else if (!isBreak) { // Only play tick during work sessions
            playSound('tick');
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, currentTask, isBreak, timeLeft, playSound]);

  const handleReset = () => {
    if (currentTask && !isBreak) {
      setTimeLeft(calculateTimeLeft(currentTask));
    } else {
      setTimeLeft(isBreak ? 5 * 60 : 25 * 60);
    }
    setIsBreak(false);
    setIsRunning(false);
    toast.info("Timer reset");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Only calculate progress if timeLeft is not null
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

  if (!isVisible) return null;

  return (
    <div className="glass p-4 md:p-6 rounded-lg shadow-lg space-y-4 md:space-y-6 animate-slideIn w-full max-w-5xl mx-auto">
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
      />
    </div>
  );
};
