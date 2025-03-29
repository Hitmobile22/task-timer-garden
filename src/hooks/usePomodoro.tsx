import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { isTaskInFuture, isTaskTimeBlock, isTaskInBacklog } from '@/utils/taskUtils';
import { calculateTimeUntilTaskStart } from '@/utils/timerUtils';

export const usePomodoro = (activeTaskId?: number, autoStart = false) => {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isBreak, setIsBreak] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSubtaskIndex, setCurrentSubtaskIndex] = useState(0);
  const [isCountdownToNextTask, setIsCountdownToNextTask] = useState(false);
  const isTransitioning = useRef(false);
  const shouldBeFullscreen = useRef(false);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fullscreenRetryCount = useRef(0);
  const maxFullscreenRetries = 3;
  const queryClient = useQueryClient();
  
  const { data: activeTasks } = useQuery({
    queryKey: ['active-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .in('Progress', ['Not started', 'In progress'])
        .order('date_started', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  const currentTask = activeTaskId
    ? activeTasks?.find(t => t.id === activeTaskId && !isTaskInFuture(t) && !isTaskInBacklog(t))
    : activeTasks?.find(t => (t.Progress === 'In progress' || t.Progress === 'Not started') && !isTaskInFuture(t) && !isTaskInBacklog(t));

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

  const getNextTask = () => {
    if (!activeTasks || activeTasks.length === 0) return null;

    const now = new Date();
    
    const sortedFutureTasks = [...activeTasks]
      .filter(task => {
        if (task.Progress === 'Backlog' || task.Progress === 'Completed') return false;
        if (!task.date_started) return false;
        const startTime = new Date(task.date_started);
        return startTime.getTime() > now.getTime();
      })
      .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime());
    
    return sortedFutureTasks.length > 0 ? sortedFutureTasks[0] : null;
  };

  const calculateTimeToNextTask = (nextTask: any) => {
    if (!nextTask || !nextTask.date_started) return null;
    return calculateTimeUntilTaskStart(nextTask.date_started);
  };

  const calculateTimeLeft = (task: any) => {
    if (!task || !task.date_due) return 25 * 60;

    const now = new Date();
    const dueTime = new Date(task.date_due);
    const diffInSeconds = Math.floor((dueTime.getTime() - now.getTime()) / 1000);

    if (isTaskTimeBlock(task)) {
      if (diffInSeconds <= 0) return 25 * 60;
      return diffInSeconds > 0 ? diffInSeconds : 25 * 60;
    }

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

  const requestFullscreenSafely = async (element: HTMLElement | null) => {
    if (!element) {
      console.log("Fullscreen container element is not available");
      return false;
    }
    
    if (document.fullscreenElement) {
      console.log("Already in fullscreen mode");
      return true;
    }
    
    try {
      fullscreenRetryCount.current = 0;
      await element.requestFullscreen();
      console.log("Successfully entered fullscreen mode");
      return true;
    } catch (err) {
      console.error("Error entering fullscreen mode:", err);
      return false;
    }
  };

  const retryFullscreen = (element: HTMLElement | null) => {
    if (fullscreenRetryCount.current >= maxFullscreenRetries) {
      console.log(`Maximum fullscreen retry attempts (${maxFullscreenRetries}) reached, giving up`);
      return;
    }
    
    const delay = Math.pow(2, fullscreenRetryCount.current) * 100;
    console.log(`Retry #${fullscreenRetryCount.current + 1} for fullscreen in ${delay}ms`);
    
    setTimeout(async () => {
      if (!document.fullscreenElement && shouldBeFullscreen.current) {
        fullscreenRetryCount.current++;
        try {
          const success = await requestFullscreenSafely(element);
          if (success) {
            setIsFullscreen(true);
            console.log("Fullscreen restored on retry #", fullscreenRetryCount.current);
          } else if (fullscreenRetryCount.current < maxFullscreenRetries) {
            retryFullscreen(element);
          }
        } catch (err) {
          console.error("Error during fullscreen retry:", err);
          if (fullscreenRetryCount.current < maxFullscreenRetries) {
            retryFullscreen(element);
          }
        }
      }
    }, delay);
  };

  const toggleFullscreen = (fullscreenElement: HTMLElement | null) => {
    if (!document.fullscreenElement) {
      shouldBeFullscreen.current = true;
      requestFullscreenSafely(fullscreenElement).then(success => {
        if (success) {
          setIsFullscreen(true);
          localStorage.setItem('pomodoroFullscreen', 'true');
        }
      });
    } else {
      shouldBeFullscreen.current = false;
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        localStorage.removeItem('pomodoroFullscreen');
      }).catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`);
      });
    }
  };

  useEffect(() => {
    if (subtasks && subtasks.length > 0) {
      const interval = setInterval(() => {
        setCurrentSubtaskIndex(prev => (prev + 1) % subtasks.length);
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [subtasks]);

  useEffect(() => {
    if (currentTask && !isBreak) {
      setIsCountdownToNextTask(false);
      const remaining = calculateTimeLeft(currentTask);
      setTimeLeft(remaining);
    } else if (isBreak) {
      if (isCountdownToNextTask) {
        const nextTask = getNextTask();
        if (nextTask) {
          const timeToNext = calculateTimeToNextTask(nextTask);
          if (timeToNext !== null) {
            setTimeLeft(timeToNext);
          } else {
            setTimeLeft(5 * 60);
          }
        } else {
          setTimeLeft(5 * 60);
          setIsCountdownToNextTask(false);
        }
      } else {
        setTimeLeft(5 * 60);
      }
    } else {
      const nextTask = getNextTask();
      if (nextTask) {
        const timeToNext = calculateTimeToNextTask(nextTask);
        if (timeToNext !== null && timeToNext <= 10 * 60) {
          setIsCountdownToNextTask(true);
          setIsBreak(true);
          setTimeLeft(timeToNext);
        } else {
          setIsCountdownToNextTask(false);
        }
      } else {
        setIsCountdownToNextTask(false);
      }
    }
  }, [currentTask, isBreak, activeTasks]);

  useEffect(() => {
    if ((autoStart || activeTaskId) && activeTasks && activeTasks.length > 0 && !isRunning) {
      const validTaskExists = activeTasks.some(t => 
        t.Progress !== 'Backlog' && !isTaskInFuture(t)
      );
      
      if (validTaskExists) {
        setIsRunning(true);
      } else {
        const nextTask = getNextTask();
        if (nextTask) {
          const timeToNext = calculateTimeToNextTask(nextTask);
          if (timeToNext !== null && timeToNext <= 10 * 60) {
            setIsRunning(true);
          }
        }
      }
    }
  }, [autoStart, activeTaskId, activeTasks?.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && timeLeft !== null) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (!prev || prev <= 1) {
            isTransitioning.current = true;
            
            shouldBeFullscreen.current = document.fullscreenElement !== null;
            console.log("Saving fullscreen state before transition:", shouldBeFullscreen.current);
            
            if (isBreak) {
              if (isCountdownToNextTask) {
                queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
                setIsBreak(false);
                setIsCountdownToNextTask(false);
                toast.success("Time to start the next task!");
              } else {
                setIsBreak(false);
                toast.success("Break finished! Starting next task.");
              }
              
              transitionTimeoutRef.current = setTimeout(() => {
                isTransitioning.current = false;
              }, 500);
              
              if (currentTask) {
                return calculateTimeLeft(currentTask);
              } else {
                const nextTask = getNextTask();
                if (nextTask) {
                  const timeToNext = calculateTimeToNextTask(nextTask);
                  if (timeToNext === null || timeToNext <= 0) {
                    return calculateTimeLeft(nextTask);
                  } else if (timeToNext <= 10 * 60) {
                    setIsCountdownToNextTask(true);
                    return timeToNext;
                  } else {
                    setIsRunning(false);
                    return 0;
                  }
                } else {
                  setIsRunning(false);
                  return 0;
                }
              }
            } else if (currentTask) {
              if (currentTask.Progress !== 'Backlog' && !isTaskInFuture(currentTask)) {
                updateTaskProgress.mutate(currentTask.id);
                
                const nextTask = getNextTask();
                if (nextTask) {
                  const timeToNext = calculateTimeToNextTask(nextTask);
                  if (timeToNext !== null && timeToNext <= 10 * 60) {
                    setIsCountdownToNextTask(true);
                    setIsBreak(true);
                    toast.success(`Work session complete! Countdown to next task starting in ${Math.ceil(timeToNext / 60)} minutes.`);
                    
                    transitionTimeoutRef.current = setTimeout(() => {
                      isTransitioning.current = false;
                    }, 500);
                    
                    return timeToNext;
                  } else {
                    setIsBreak(true);
                    toast.success("Work session complete! Time for a break.");
                    
                    transitionTimeoutRef.current = setTimeout(() => {
                      isTransitioning.current = false;
                    }, 500);
                    
                    return 5 * 60;
                  }
                } else {
                  setIsBreak(true);
                  toast.success("Work session complete! Time for a break.");
                  
                  transitionTimeoutRef.current = setTimeout(() => {
                    isTransitioning.current = false;
                  }, 500);
                  
                  return 5 * 60;
                }
              } else {
                toast.error("Cannot complete this task - it's in backlog or scheduled for the future");
                setIsRunning(false);
                
                transitionTimeoutRef.current = setTimeout(() => {
                  isTransitioning.current = false;
                }, 500);
                
                return prev;
              }
            } else {
              const nextTask = getNextTask();
              if (nextTask) {
                const timeToNext = calculateTimeToNextTask(nextTask);
                if (timeToNext !== null && timeToNext <= 10 * 60) {
                  setIsCountdownToNextTask(true);
                  setIsBreak(true);
                  return timeToNext;
                } else if (timeToNext === null || timeToNext <= 0) {
                  setIsCountdownToNextTask(false);
                  setIsBreak(false);
                  return calculateTimeLeft(nextTask);
                }
              }
              
              setIsRunning(false);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      clearInterval(interval);
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [isRunning, currentTask, isBreak, timeLeft, isCountdownToNextTask]);

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

  return {
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
  };
};
