import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PomodoroTimerProps {
  tasks: string[];
  autoStart?: boolean;
  activeTaskId?: number;
}

type SoundType = 'tick' | 'task' | 'break';
type SoundSettings = Record<SoundType, string>;

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ 
  tasks: initialTasks, 
  autoStart = false,
  activeTaskId 
}) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isBreak, setIsBreak] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isVisible, setIsVisible] = useState(true);
  const [soundSettings, setSoundSettings] = useState<SoundSettings>({
    tick: '/sounds/Tick/Tick1.wav',
    task: '/sounds/Task/Task1.wav',
    break: '/sounds/Break/Break1.wav'
  });
  const [availableSounds, setAvailableSounds] = useState<Record<SoundType, string[]>>({
    tick: [],
    task: [],
    break: []
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadSounds = async () => {
      try {
        const fetchSoundsFromFolder = async (folder: string) => {
          const response = await fetch(`/sounds/${folder}`);
          const text = await response.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const files = Array.from(doc.querySelectorAll('a'))
            .map(a => a.href)
            .filter(href => href.endsWith('.wav'))
            .map(href => `/sounds/${folder}/${href.split('/').pop()}`);
          return files;
        };

        const [tickSounds, taskSounds, breakSounds] = await Promise.all([
          fetchSoundsFromFolder('Tick'),
          fetchSoundsFromFolder('Task'),
          fetchSoundsFromFolder('Break')
        ]);

        setAvailableSounds({
          tick: tickSounds,
          task: taskSounds,
          break: breakSounds
        });
      } catch (error) {
        console.error('Error loading sounds:', error);
      }
    };

    loadSounds();
  }, []);

  const playSound = useCallback((type: SoundType) => {
    if (!isMuted && isVisible) {
      const audio = new Audio(soundSettings[type]);
      audio.play().catch(error => console.error('Error playing sound:', error));
    }
  }, [isMuted, isVisible, soundSettings]);

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
      // Check if task starts within the next 10 minutes
      return timeDiff > 0 && timeDiff <= 10 * 60 * 1000;
    });
  };

  const shouldShowTimer = () => {
    if (currentTask && new Date() >= new Date(currentTask.date_started)) {
      return true;
    }

    const nextTask = getNextTask();
    if (nextTask) {
      const now = new Date();
      const startTime = new Date(nextTask.date_started);
      const timeDiff = startTime.getTime() - now.getTime();
      // Show timer if we're within 10 minutes of the next task
      return timeDiff <= 10 * 60 * 1000 && timeDiff > 0;
    }

    return false;
  };

  useEffect(() => {
    setIsVisible(shouldShowTimer());
  }, [currentTask, getNextTask]);

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

  useEffect(() => {
    if ((autoStart || activeTaskId) && activeTasks && activeTasks.length > 0 && !isRunning) {
      setIsRunning(true);
      toast.info("Timer started automatically");
    }
  }, [autoStart, activeTaskId, activeTasks?.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (isBreak) {
              setIsBreak(false);
              playSound('task');
              toast.success("Break finished! Starting next task.");
              return 25 * 60;
            } else if (currentTask) {
              updateTaskProgress.mutate(currentTask.id);
              setIsBreak(true);
              playSound('break');
              toast.success("Work session complete! Time for a break.");
              return 5 * 60;
            }
          } else {
            playSound('tick');
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, currentTask, isBreak, playSound]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    setTimeLeft(25 * 60);
    setIsBreak(false);
    setIsRunning(false);
    toast.info("Timer reset");
  };

  const progress = isBreak
    ? ((timeLeft) / (10 * 60)) * 100
    : ((25 * 60 - timeLeft) / (25 * 60)) * 100;

  const getTimerColor = () => {
    if (isBreak) {
      return 'linear-gradient(184.1deg, rgba(249,255,182,1) 44.7%, rgba(226,255,172,1) 67.2%)';
    }
    
    const progress = ((25 * 60 - timeLeft) / (25 * 60)) * 100;
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

  if (!shouldShowTimer()) return null;

  return (
    <div className="glass p-6 rounded-lg shadow-lg space-y-6 animate-slideIn">
      <div className="space-y-2">
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
        className="relative p-8 rounded-xl transition-all duration-300 shadow-lg"
        style={{
          background: getTimerColor(),
        }}
      >
        <span className="text-5xl font-mono font-bold text-primary text-center block">
          {formatTime(timeLeft)}
        </span>
      </div>

      <Progress 
        value={progress} 
        className="h-2"
      />

      <div className="flex justify-center gap-4">
        <Button
          onClick={() => {
            setIsRunning(!isRunning);
            if (!isRunning) {
              toast.info(isBreak ? "Break started" : "Work session started");
              playSound(isBreak ? 'break' : 'task');
            }
          }}
          className="hover-lift"
          variant="outline"
        >
          {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="hover-lift"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          onClick={() => setIsMuted(!isMuted)}
          variant="outline"
          className="hover-lift"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="hover-lift"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Sound Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Tick Sound</DropdownMenuLabel>
              {availableSounds.tick.map((sound, index) => (
                <DropdownMenuItem
                  key={sound}
                  onClick={() => setSoundSettings(prev => ({ ...prev, tick: sound }))}
                >
                  Tick Sound {index + 1}
                  {soundSettings.tick === sound && " ✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Task Sound</DropdownMenuLabel>
              {availableSounds.task.map((sound, index) => (
                <DropdownMenuItem
                  key={sound}
                  onClick={() => setSoundSettings(prev => ({ ...prev, task: sound }))}
                >
                  Task Sound {index + 1}
                  {soundSettings.task === sound && " ✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="px-2 py-1.5 text-sm font-semibold">Break Sound</DropdownMenuLabel>
              {availableSounds.break.map((sound, index) => (
                <DropdownMenuItem
                  key={sound}
                  onClick={() => setSoundSettings(prev => ({ ...prev, break: sound }))}
                >
                  Break Sound {index + 1}
                  {soundSettings.break === sound && " ✓"}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
