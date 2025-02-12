
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface PomodoroTimerProps {
  tasks: string[];
  autoStart?: boolean;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ tasks, autoStart = false }) => {
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [isBreak, setIsBreak] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    // Start the timer automatically if autoStart is true and there are tasks
    if (autoStart && tasks.length > 0 && !isRunning) {
      setIsRunning(true);
      toast.info("Timer started automatically");
    }
  }, [autoStart, tasks.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && tasks.length > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Time's up
            if (isBreak) {
              // End of break
              setIsBreak(false);
              if (currentTaskIndex < tasks.length - 1) {
                setCurrentTaskIndex(c => c + 1);
                toast.success("Break finished! Starting next task.");
              } else {
                setIsRunning(false);
                toast.success("All tasks completed!");
              }
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
  }, [isRunning, currentTaskIndex, isBreak, tasks.length]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleReset = () => {
    setTimeLeft(25 * 60);
    setCurrentTaskIndex(0);
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
        {tasks[currentTaskIndex] && (
          <p className="text-center text-muted-foreground">
            {isBreak ? 'Take a breather' : `Working on: ${tasks[currentTaskIndex]}`}
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
          disabled={tasks.length === 0}
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
