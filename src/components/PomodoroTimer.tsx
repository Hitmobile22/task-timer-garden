
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

interface PomodoroTimerProps {
  tasks: string[];
  autoStart?: boolean;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ tasks: initialTasks, autoStart = false }) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isBreak, setIsBreak] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Fetch active tasks from Supabase
  const { data: activeTasks } = useQuery({
    queryKey: ['active-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .eq('Progress', 'Not started')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const currentTask = activeTasks && activeTasks.length > 0 ? activeTasks[0] : null;

  useEffect(() => {
    // Start the timer automatically if autoStart is true and there are tasks
    if (autoStart && activeTasks && activeTasks.length > 0 && !isRunning) {
      setIsRunning(true);
      toast.info("Timer started automatically");
    }
  }, [autoStart, activeTasks?.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && currentTask) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Time's up
            if (isBreak) {
              // End of break
              setIsBreak(false);
              toast.success("Break finished! Starting next task.");
              return 25 * 60;
            } else {
              // End of work session
              setIsBreak(true);
              toast.success("Work session complete! Time for a break.");
              return 5 * 60;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isRunning, currentTask, isBreak]);

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
    ? ((5 * 60 - timeLeft) / (5 * 60)) * 100
    : ((25 * 60 - timeLeft) / (25 * 60)) * 100;

  return (
    <div className="glass p-6 rounded-lg shadow-sm space-y-6 animate-slideIn">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-center">
          {isBreak ? 'Break Time' : 'Work Session'}
        </h2>
        {currentTask && (
          <p className="text-center text-muted-foreground">
            {isBreak ? 'Take a breather' : `Working on: ${currentTask["Task Name"]}`}
          </p>
        )}
      </div>

      <div className="text-center">
        <span className="text-5xl font-mono font-bold animate-pulse-subtle">
          {formatTime(timeLeft)}
        </span>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex justify-center gap-4">
        <Button
          onClick={() => {
            setIsRunning(!isRunning);
            if (!isRunning) {
              toast.info(isBreak ? "Break started" : "Work session started");
            }
          }}
          disabled={!currentTask}
          className="hover-lift"
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
      </div>
    </div>
  );
};
