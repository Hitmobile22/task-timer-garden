import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import { Play, Pause, SkipForward, FullscreenIcon, Maximize2, Minimize2, X, Shuffle } from 'lucide-react';
import { cn } from "@/lib/utils";

interface PomodoroTimerProps {
  tasks?: string[];
  autoStart?: boolean;
  activeTaskId?: number;
  onShuffleTasks?: () => Promise<void>;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ 
  tasks = [], 
  autoStart = false,
  activeTaskId,
  onShuffleTasks
}) => {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const timerContainerRef = useRef<HTMLDivElement>(null);
  
  const currentTask = tasks[currentTaskIndex];
  
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const progressPercentage = ((25 * 60) - timeLeft) / (25 * 60) * 100;
  
  useEffect(() => {
    if (autoStart) {
      setIsActive(true);
    }
  }, [autoStart]);
  
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isActive) {
      interval = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 0) {
            clearInterval(interval!);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (interval) {
      clearInterval(interval);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isActive]);
  
  useEffect(() => {
    if (timeLeft === 0) {
      if (isBreak) {
        setIsBreak(false);
        setTimeLeft(25 * 60);
        setIsActive(false);
        toast.success('Focus session started!');
      } else {
        setIsBreak(true);
        setTimeLeft(5 * 60);
        setIsActive(false);
        setSessionCount(prevCount => prevCount + 1);
        toast.success('Break time!');
      }
    }
  }, [timeLeft, isBreak]);
  
  const toggleFullscreen = useCallback(() => {
    if (!timerContainerRef.current) return;
    
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      setIsFullscreen(true);
      if (timerContainerRef.current.requestFullscreen) {
        timerContainerRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      } else if ((timerContainerRef.current as any).webkitRequestFullscreen) {
        (timerContainerRef.current as any).webkitRequestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } else {
      exitFullscreen();
    }
  }, []);
  
  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      setIsFullscreen(false);
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => {
          console.error(`Error attempting to exit fullscreen: ${err.message}`);
        });
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen().catch(err => {
          console.error(`Error attempting to exit fullscreen: ${err.message}`);
        });
      }
    }
  }, []);
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement || !!(document as any).webkitFullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  const startTimer = () => {
    setIsActive(true);
  };
  
  const pauseTimer = () => {
    setIsActive(false);
  };
  
  const skipToBreak = () => {
    setTimeLeft(0);
  };
  
  return (
    <div 
      ref={timerContainerRef} 
      className={cn(
        "w-full rounded-lg p-4", 
        isFullscreen ? "fixed inset-0 bg-white z-50 flex flex-col items-center justify-center" : ""
      )}
    >
      {isFullscreen && (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={exitFullscreen}
          className="absolute top-4 right-4 z-10"
        >
          <X className="h-6 w-6" />
        </Button>
      )}
      
      <Card className={cn(
        "w-full border-none bg-white/10 backdrop-blur-lg shadow-none", 
        isFullscreen ? "max-w-xl" : ""
      )}>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6">
            {/* Timer display and current task */}
            <div className="text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-2 tracking-tight">{formatTime(timeLeft)}</h2>
              <p className={cn(
                "text-lg md:text-xl font-medium mb-4",
                isBreak ? "text-green-600" : "text-blue-600"
              )}>
                {isBreak ? "Break Time" : currentTask || "Focus Time"}
              </p>
              
              {/* Progress bar */}
              <Progress value={progressPercentage} className="h-2 mb-6" />
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-3">
              <Button 
                size="icon" 
                variant="outline"
                className="h-12 w-12 rounded-full border-2"
                onClick={isActive ? pauseTimer : startTimer}
              >
                {isActive ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              
              <Button 
                size="icon" 
                variant="outline"
                className="h-12 w-12 rounded-full border-2"
                onClick={skipToBreak}
              >
                <SkipForward className="h-5 w-5" />
              </Button>
              
              <Button 
                size="icon" 
                variant="outline"
                className="h-12 w-12 rounded-full border-2"
                onClick={toggleFullscreen}
              >
                {isFullscreen ? 
                  <Minimize2 className="h-5 w-5" /> : 
                  <Maximize2 className="h-5 w-5" />
                }
              </Button>
              
              {onShuffleTasks && (
                <Button 
                  size="icon" 
                  variant="outline"
                  className="h-12 w-12 rounded-full border-2"
                  onClick={onShuffleTasks}
                >
                  <Shuffle className="h-5 w-5" />
                </Button>
              )}
            </div>
            
            {/* Task list (only show if we have tasks) */}
            {tasks.length > 0 && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Tasks:</h3>
                <ul className="space-y-2">
                  {tasks.map((task, index) => (
                    <li 
                      key={index} 
                      className={cn(
                        "p-2 rounded-lg",
                        index === 0 && !isBreak ? "bg-blue-100/50 font-semibold" : ""
                      )}
                    >
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
