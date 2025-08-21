import React, { useState, useEffect } from 'react';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { PomodoroTimer } from './PomodoroTimer';
import { MenuBar } from './MenuBar';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { TASK_LIST_COLORS } from '@/constants/taskColors';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Task } from '@/types/task.types';
import { useIsMobile } from '@/hooks/use-mobile';
import { isTaskTimeBlock, isTaskInFuture } from '@/utils/taskUtils';
import { syncGoogleCalendar } from './task/GoogleCalendarIntegration';
import { NotificationBell } from './notifications/NotificationBell';
import { useUnifiedRecurringTasksCheck } from '@/hooks/useUnifiedRecurringTasksCheck';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface SubTask {
  name: string;
}
interface NewTask {
  name: string;
  subtasks: SubTask[];
}

interface TaskSchedulerProps {
  onShuffleTasks?: () => Promise<void>;
}

export const TaskScheduler: React.FC<TaskSchedulerProps> = ({ onShuffleTasks }) => {
  const [tasks, setTasks] = useState<NewTask[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number>();
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  // Use the unified recurring task checker
  const recurringTasksChecker = useUnifiedRecurringTasksCheck();
  
  // Add button to manually trigger recurring task generation
  const triggerRecurringTasksGeneration = async () => {
    setIsGeneratingTasks(true);
    toast.info('Checking for recurring tasks...');
    
    try {
      await recurringTasksChecker.forceCheck();
      toast.success('Recurring tasks updated');
    } catch (error) {
      console.error('Error triggering recurring tasks:', error);
      toast.error('Failed to check recurring tasks');
    } finally {
      setIsGeneratingTasks(false);
    }
  };
  
  const {
    data: taskLists
  } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('TaskLists').select('*').order('created_at', {
        ascending: true
      });
      if (error) throw error;
      return data;
    }
  });
  
  const {
    data: activeTasks
  } = useQuery({
    queryKey: ['active-tasks'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('Tasks').select('*')
        .in('Progress', ['Not started', 'In progress'])
        .neq('Progress', 'Backlog')
        .order('date_started', {
          ascending: true
        });
      if (error) throw error;
      return (data || []).filter(task => {
        return task.Progress && task.Progress !== 'Backlog';
      }) as Task[];
    }
  });
  
  useEffect(() => {
    if (activeTasks && activeTasks.length > 0) {
      setShowTimer(true);
      const inProgressTask = activeTasks.find(task => task.Progress === 'In progress');
      setTimerStarted(!!inProgressTask);
      
      const firstTask = activeTasks.find(task => !isTaskInFuture(task) && task.Progress !== 'Backlog');
      if (firstTask) {
        setActiveTaskId(firstTask.id);
      }
    } else {
      setShowTimer(true);
      setTimerStarted(false);
    }
  }, [activeTasks, activeTaskId]);
  
  const handleTasksCreate = async (newTasks: NewTask[]) => {
    try {
      setTasks(newTasks);
      setShowTimer(true);
      setTimerStarted(true);
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['subtasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['active-tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['task-lists']
      });
      
      syncGoogleCalendar().catch(err => console.error("Failed to sync calendar after creating tasks:", err));
      
      toast.success('Tasks created successfully');
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast.error('Failed to create tasks');
    }
  };
  
  const handleTimeBlockCreate = async (timeBlock: Task) => {
    try {
      if (activeTasks && activeTasks.length > 0) {
        const timeBlockStart = new Date(timeBlock.date_started || '');
        const timeBlockEnd = new Date(timeBlock.date_due || '');
        
        const tasksToReschedule = activeTasks
          .filter(task => {
            if (isTaskTimeBlock(task)) {
              return false;
            }
            if (task.Progress === 'In progress' || task.id === timeBlock.id) {
              return false;
            }
            
            const taskStart = new Date(task.date_started || '');
            const taskEnd = new Date(task.date_due || '');
            
            if (
              (taskStart >= timeBlockStart && taskStart < timeBlockEnd) ||
              (taskEnd > timeBlockStart && taskEnd <= timeBlockEnd) ||
              (taskStart <= timeBlockStart && taskEnd >= timeBlockEnd)
            ) {
              return true;
            }
            
            return false;
          })
          .sort((a, b) => {
            const dateA = new Date(a.date_started || '').getTime();
            const dateB = new Date(b.date_started || '').getTime();
            return dateA - dateB;
          });
        
        if (tasksToReschedule.length > 0) {
          const nextAvailableTime = new Date(timeBlockEnd.getTime() + 5 * 60 * 1000);
          
          for (let i = 0; i < tasksToReschedule.length; i++) {
            const task = tasksToReschedule[i];
            const originalDuration = new Date(task.date_due || '').getTime() - new Date(task.date_started || '').getTime();
            
            const newStartTime = new Date(nextAvailableTime.getTime() + (i * 30 * 60 * 1000));
            const newEndTime = new Date(newStartTime.getTime() + originalDuration);
            
            await supabase
              .from('Tasks')
              .update({
                date_started: newStartTime.toISOString(),
                date_due: newEndTime.toISOString()
              })
              .eq('id', task.id);
          }
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
          toast.success(`Rescheduled ${tasksToReschedule.length} tasks around time block`);
        }
      }
      
      syncGoogleCalendar().catch(err => console.error("Failed to sync calendar after creating time block:", err));
      
    } catch (error) {
      console.error('Error handling time block creation:', error);
      toast.error('Failed to reschedule tasks around time block');
    }
  };
  
  const handleTaskStart = async (taskId: number) => {
    try {
      const targetTask = activeTasks?.find(t => t.id === taskId);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const tasksToReschedule = activeTasks?.filter(t => {
        if (isTaskTimeBlock(t)) {
          return false;
        }
        
        const taskDate = t.date_started ? new Date(t.date_started) : null;
        const isValidProgress = t.Progress === 'Not started' || t.Progress === 'In progress';
        return isValidProgress && taskDate && taskDate < tomorrow;
      }).sort((a, b) => {
        const dateA = a.date_started ? new Date(a.date_started).getTime() : 0;
        const dateB = b.date_started ? new Date(b.date_started).getTime() : 0;
        return dateA - dateB;
      }) || [];
      
      const selectedTask = activeTasks?.find(t => t.id === taskId);
      const currentTask = activeTasks?.find(t => t.Progress === 'In progress');
      
      if (!selectedTask) return;
      
      // Check if the selected task is a time block
      if (isTaskTimeBlock(selectedTask)) {
        toast.info("Time blocks can't be started as tasks");
        return;
      }
      
      // Start the selected task with current time
      const currentTime = new Date();
      
      // Always update the selected task to current time, regardless of whether it's already "In progress"
      const { error: updateError } = await supabase
        .from('Tasks')
        .update({
          Progress: 'In progress',
          date_started: currentTime.toISOString(),
          date_due: new Date(currentTime.getTime() + 25 * 60 * 1000).toISOString()
        })
        .eq('id', taskId);
        
      if (updateError) throw updateError;
      
      // Get all time blocks to avoid scheduling conflicts
      const timeBlocks = activeTasks
        ?.filter(t => isTaskTimeBlock(t))
        .map(t => ({
          start: new Date(t.date_started || ''),
          end: new Date(t.date_due || '')
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime()) || [];
      
      // Determine starting point for rescheduling other tasks
      let nextStartTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
      
      // Reschedule all affected tasks (from today or earlier)
      for (const task of tasksToReschedule) {
        // Skip the task we're starting and time blocks
        if (task.id === taskId || (currentTask && task.id === currentTask.id && task.id !== taskId) || isTaskTimeBlock(task)) continue;
        if (nextStartTime >= tomorrow) break;
        
        let taskStartTime = new Date(nextStartTime);
        let taskDueTime = new Date(taskStartTime.getTime() + 25 * 60 * 1000);
        
        // Avoid scheduling conflicts with time blocks
        let needsRescheduling = true;
        while (needsRescheduling) {
          needsRescheduling = false;
          
          for (const block of timeBlocks) {
            if (
              (taskStartTime >= block.start && taskStartTime < block.end) ||
              (taskDueTime > block.start && taskDueTime <= block.end) ||
              (taskStartTime <= block.start && taskDueTime >= block.end)
            ) {
              taskStartTime = new Date(block.end.getTime() + 5 * 60 * 1000);
              taskDueTime = new Date(taskStartTime.getTime() + 25 * 60 * 1000);
              needsRescheduling = true;
              break;
            }
          }
        }
        
        const {
          error
        } = await supabase.from('Tasks').update({
          date_started: taskStartTime.toISOString(),
          date_due: taskDueTime.toISOString(),
          Progress: 'Not started'
        }).eq('id', task.id);
        
        if (error) throw error;
        
        nextStartTime = new Date(taskDueTime.getTime() + 5 * 60 * 1000);
      }
      
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['active-tasks']
      });
      
      syncGoogleCalendar().catch(err => console.error("Failed to sync calendar after starting task:", err));
      
      toast.success('Timer started with selected task');
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Failed to start task');
    }
  };
  
  const handleShuffleTasks = async () => {
    if (onShuffleTasks) {
      await onShuffleTasks();
      syncGoogleCalendar().catch(err => console.error("Failed to sync calendar after shuffling tasks:", err));
      return;
    }
    
    try {
      const { data: tasks, error } = await supabase
        .from('Tasks')
        .select('*')
        .in('Progress', ['Not started', 'In progress'])
        .neq('Progress', 'Backlog')
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      if (!tasks || tasks.length < 2) {
        toast.info('Not enough tasks to shuffle');
        return;
      }
      
      const regularTasks = tasks.filter(t => !isTaskTimeBlock(t));
      const timeBlocks = tasks.filter(t => isTaskTimeBlock(t));
      
      if (regularTasks.length < 2) {
        toast.info('Not enough regular tasks to shuffle');
        return;
      }
      
      const todayRegularTasks = getTodayTasks(regularTasks);
      if (todayRegularTasks.length < 2) {
        toast.info('Not enough tasks to shuffle today');
        return;
      }
      
      const currentTask = todayRegularTasks.find(t => t.Progress === 'In progress');
      const tasksToShuffle = currentTask 
        ? todayRegularTasks.filter(t => t.id !== currentTask.id)
        : todayRegularTasks.slice(1);
      
      for (let i = tasksToShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tasksToShuffle[i], tasksToShuffle[j]] = [tasksToShuffle[j], tasksToShuffle[i]];
      }
      
      const shuffledTasks = currentTask 
        ? [currentTask, ...tasksToShuffle]
        : [...todayRegularTasks.slice(0, 1), ...tasksToShuffle];
      
      const currentTime = new Date();
      let startTime = currentTime;
      
      if (currentTask) {
        startTime = new Date(new Date(currentTask.date_due).getTime() + 5 * 60 * 1000);
      }
      
      const nonTimeBlockTasks = shuffledTasks.filter(t => !isTaskTimeBlock(t));
      
      timeBlocks.sort((a, b) => {
        const aTime = new Date(a.date_started).getTime();
        const bTime = new Date(b.date_started).getTime();
        return aTime - bTime;
      });
      
      let currentScheduleTime = startTime;
      
      for (const task of nonTimeBlockTasks) {
        if (currentTask && task.id === currentTask.id) continue;
        
        const timeBlockConflicts = timeBlocks.filter(block => {
          const blockStart = new Date(block.date_started);
          const blockEnd = new Date(block.date_due);
          
          const taskEnd = new Date(currentScheduleTime.getTime() + 25 * 60 * 1000);
          
          return (
            (currentScheduleTime >= blockStart && currentScheduleTime < blockEnd) ||
            (taskEnd > blockStart && taskEnd <= blockEnd) ||
            (currentScheduleTime <= blockStart && taskEnd >= blockEnd)
          );
        });
        
        if (timeBlockConflicts.length > 0) {
          const latestBlock = timeBlockConflicts.reduce((latest, block) => {
            const blockEnd = new Date(block.date_due);
            return blockEnd > latest ? blockEnd : latest;
          }, new Date(0));
          
          currentScheduleTime = new Date(latestBlock.getTime() + 5 * 60 * 1000);
        }
        
        const taskStartTime = new Date(currentScheduleTime);
        const taskEndTime = new Date(taskStartTime.getTime() + 25 * 60 * 1000);
        
        await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            Progress: 'Not started'
          })
          .eq('id', task.id);
        
        currentScheduleTime = new Date(taskEndTime.getTime() + 5 * 60 * 1000);
      }
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      
      syncGoogleCalendar().catch(err => console.error("Failed to sync calendar after shuffling tasks:", err));
      
      toast.success('Tasks shuffled successfully');
    } catch (error) {
      console.error('Error shuffling tasks:', error);
      toast.error('Failed to shuffle tasks');
    }
  };
  
  const getTodayTasks = (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return [];
    
    tasks = tasks.filter(task => task.Progress !== 'Backlog');
    
    const now = new Date();
    
    // Get current time in EST timezone using date-fns-tz
    const EST_TIMEZONE = 'America/New_York';
    const nowEST = new Date(now.toLocaleString("en-US", {timeZone: EST_TIMEZONE}));
    const estHour = nowEST.getHours();
    const isEveningMode = estHour >= 21 || estHour < 3;
    
    console.log('TaskScheduler getTodayTasks:', {
      currentTime: now.toISOString(),
      estTime: nowEST.toISOString(),
      estHour,
      isEveningMode
    });
    
    if (isEveningMode) {
      // Evening mode: ONLY show current evening session (9 PM EST - 3 AM EST)
      let currentSessionStart: Date, currentSessionEnd: Date;
      
      if (estHour >= 21) {
        // Currently after 9 PM - current session is 9 PM today to 3 AM tomorrow
        currentSessionStart = new Date(nowEST);
        currentSessionStart.setHours(21, 0, 0, 0);
        
        currentSessionEnd = new Date(nowEST);
        currentSessionEnd.setDate(currentSessionEnd.getDate() + 1);
        currentSessionEnd.setHours(3, 0, 0, 0);
      } else {
        // Currently before 3 AM - current session is 9 PM yesterday to 3 AM today
        currentSessionStart = new Date(nowEST);
        currentSessionStart.setDate(currentSessionStart.getDate() - 1);
        currentSessionStart.setHours(21, 0, 0, 0);
        
        currentSessionEnd = new Date(nowEST);
        currentSessionEnd.setHours(3, 0, 0, 0);
      }
      
      // Use proper date-fns-tz conversion from EST to UTC
      const currentSessionStartUTC = new Date(currentSessionStart.getTime() - currentSessionStart.getTimezoneOffset() * 60000);
      const currentSessionEndUTC = new Date(currentSessionEnd.getTime() - currentSessionEnd.getTimezoneOffset() * 60000);
      
      console.log('Evening mode boundaries:', {
        sessionStartEST: currentSessionStart.toISOString(),
        sessionEndEST: currentSessionEnd.toISOString(),
        sessionStartUTC: currentSessionStartUTC.toISOString(), 
        sessionEndUTC: currentSessionEndUTC.toISOString()
      });
      
      const filteredTasks = tasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        
        // STRICT: Only include tasks within current evening session
        const isInSession = taskDate >= currentSessionStartUTC && taskDate < currentSessionEndUTC;
        
        if (isInSession) {
          console.log(`Including evening task: ${task["Task Name"]} at ${taskDate.toISOString()}`);
        }
        
        return isInSession;
      });
      
      console.log(`Evening mode filtered ${filteredTasks.length} tasks from ${tasks.length} total`);
      return filteredTasks;
    } else {
      // Normal mode: show only today's tasks (not tomorrow's)
      const todayEST = new Date(nowEST);
      todayEST.setHours(0, 0, 0, 0);
      
      const tomorrowEST = new Date(todayEST);
      tomorrowEST.setDate(tomorrowEST.getDate() + 1);
      
      // Convert to UTC properly
      const todayUTC = new Date(todayEST.getTime() - todayEST.getTimezoneOffset() * 60000);
      const tomorrowUTC = new Date(tomorrowEST.getTime() - tomorrowEST.getTimezoneOffset() * 60000);
      
      return tasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        return taskDate >= todayUTC && taskDate < tomorrowUTC;
      });
    }
  };
  
  const handleMoveTask = async (taskId: number, listId: number) => {
    try {
      const { error } = await supabase
        .from('Tasks')
        .update({ task_list_id: listId })
        .eq('id', taskId);
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task moved successfully');
    } catch (error) {
      console.error('Error moving task:', error);
      toast.error('Failed to move task');
    }
  };

  const activeTaskListColor = activeTaskId && activeTasks && taskLists ? (() => {
    const activeTask = activeTasks.find(t => t.id === activeTaskId);
    if (!activeTask || activeTask.task_list_id === 1) return null;
    const taskList = taskLists.find(l => l.id === activeTask.task_list_id);
    return taskList?.color || null;
  })() : null;
  
  const hasActiveTasks = activeTasks && activeTasks.length > 0;
  const hasInProgressTask = activeTasks?.some(t => t.Progress === 'In progress');
  
  return <div className="min-h-screen p-0 space-y-4 md:space-y-8 overflow-x-hidden" style={{
    background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)'
  }}>
      <div className="container mx-auto flex justify-between items-center py-4">
        <MenuBar />
        <div className="flex items-center gap-2">
          <Button
            onClick={triggerRecurringTasksGeneration}
            className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm"
            disabled={isGeneratingTasks}
            size="sm"
          >
            {isGeneratingTasks ? (
              <>
                <RefreshCw className="mr-1 h-3 w-3 animate-spin" /> Generating...
              </>
            ) : (
              'Generate Recurring Tasks'
            )}
          </Button>
          <NotificationBell />
        </div>
      </div>
      
      <main className="container mx-auto space-y-4 md:space-y-8">
        <header className="text-center space-y-2 px-4">
          <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-white">Pomouroboros Timer</h1>
          <p className="text-sm md:text-base text-white/80">It really whips the ollama's ass</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg shadow-lg w-full md:rounded-xl px-0">
          <div className="p-4 md:p-8 space-y-6 px-0 py-0">
            <div className="space-y-6 w-full">
              {showTimer && <div className="timer-container animate-slideIn rounded-lg overflow-hidden" style={{
              background: activeTaskListColor || undefined
            }}>
                  <PomodoroTimer
                    tasks={tasks.map(t => t.name)}
                    autoStart={timerStarted && hasInProgressTask}
                    activeTaskId={activeTaskId} 
                    onShuffleTasks={onShuffleTasks || handleShuffleTasks}
                  />
                </div>}
              <div className="form-control">
                <TaskForm 
                  onTasksCreate={handleTasksCreate} 
                  onTimeBlockCreate={handleTimeBlockCreate}
                />
              </div>
              <div className="task-list">
                <TaskList 
                  tasks={getTodayTasks(activeTasks || [])} 
                  onTaskStart={handleTaskStart} 
                  subtasks={[]} 
                  taskLists={taskLists} 
                  activeTaskId={activeTaskId}
                  onMoveTask={handleMoveTask}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>;
};
