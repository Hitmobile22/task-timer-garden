
import React, { useState, useEffect } from 'react';
import { TaskForm } from './TaskForm';
import { TaskListComponent } from './TaskList';
import { PomodoroTimer } from './PomodoroTimer';
import { MenuBar } from './MenuBar';
import { Button } from './ui/button';
import { MoreVertical, Shuffle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { TASK_LIST_COLORS, DEFAULT_LIST_COLOR } from '@/constants/taskColors';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Task, Subtask } from '@/types/task.types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRecurringProjectsCheck } from '@/hooks/useRecurringProjectsCheck';
import { isTaskTimeBlock } from '@/utils/taskUtils';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  useRecurringProjectsCheck();
  
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
      
      const firstRegularTask = activeTasks.find(task => !isTaskTimeBlock(task));
      if (firstRegularTask) {
        setActiveTaskId(firstRegularTask.id);
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
      toast.success('Tasks created successfully');
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast.error('Failed to create tasks');
    }
  };
  
  // Helper function to check if a task overlaps with a time block
  const overlapsWithTimeBlock = (taskStart: Date, taskEnd: Date, timeBlocks: { start: Date; end: Date }[]): boolean => {
    for (const block of timeBlocks) {
      if (
        (taskStart >= block.start && taskStart < block.end) ||
        (taskEnd > block.start && taskEnd <= block.end) ||
        (taskStart <= block.start && taskEnd >= block.end)
      ) {
        return true;
      }
    }
    return false;
  };

  // Helper function to find the next available time slot
  const findNextAvailableTime = (startTime: Date, duration: number, timeBlocks: { start: Date; end: Date }[]): Date => {
    let candidateStart = new Date(startTime);
    let candidateEnd = new Date(candidateStart.getTime() + duration);
    
    while (overlapsWithTimeBlock(candidateStart, candidateEnd, timeBlocks)) {
      // Find the earliest block that overlaps with our candidate
      const overlappingBlocks = timeBlocks.filter(block => 
        (candidateStart < block.end && candidateEnd > block.start)
      ).sort((a, b) => a.start.getTime() - b.start.getTime());
      
      if (overlappingBlocks.length > 0) {
        // Move to after the earliest overlapping block
        candidateStart = new Date(overlappingBlocks[0].end.getTime() + 5 * 60 * 1000); // 5 min buffer
        candidateEnd = new Date(candidateStart.getTime() + duration);
      } else {
        break; // No overlapping blocks found
      }
    }
    
    return candidateStart;
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
            
            const taskStart = task.date_started ? new Date(task.date_started) : null;
            const taskEnd = task.date_due ? new Date(task.date_due) : null;
            
            if (!taskStart || !taskEnd) return false;
            
            return overlapsWithTimeBlock(taskStart, taskEnd, [{start: timeBlockStart, end: timeBlockEnd}]);
          })
          .sort((a, b) => {
            const dateA = new Date(a.date_started || '').getTime();
            const dateB = new Date(b.date_started || '').getTime();
            return dateA - dateB;
          });
        
        if (tasksToReschedule.length > 0) {
          // Get all time blocks including the new one
          const timeBlocks = [
            ...activeTasks.filter(t => isTaskTimeBlock(t) && t.id !== timeBlock.id).map(t => ({
              start: new Date(t.date_started || ''),
              end: new Date(t.date_due || '')
            })),
            { start: timeBlockStart, end: timeBlockEnd }
          ].sort((a, b) => a.start.getTime() - b.start.getTime());
          
          for (const task of tasksToReschedule) {
            const originalDuration = new Date(task.date_due || '').getTime() - new Date(task.date_started || '').getTime();
            const nextAvailableTime = findNextAvailableTime(timeBlockEnd, originalDuration, timeBlocks);
            
            await supabase
              .from('Tasks')
              .update({
                date_started: nextAvailableTime.toISOString(),
                date_due: new Date(nextAvailableTime.getTime() + originalDuration).toISOString()
              })
              .eq('id', task.id);
          }
          
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
          toast.success(`Rescheduled ${tasksToReschedule.length} tasks around time block`);
        }
      }
    } catch (error) {
      console.error('Error handling time block creation:', error);
      toast.error('Failed to reschedule tasks around time block');
    }
  };
  
  const handleTaskStart = async (taskId: number) => {
    try {
      const targetTask = activeTasks?.find(t => t.id === taskId);
      
      if (!targetTask || isTaskTimeBlock(targetTask)) {
        toast.info("Time blocks can't be started as tasks");
        return;
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Filter to only get today's non-time-block tasks
      const notStartedTasks = activeTasks?.filter(t => {
        if (isTaskTimeBlock(t)) {
          return false;
        }
        
        const taskDate = t.date_started ? new Date(t.date_started) : null;
        const isValidProgress = t.Progress === 'Not started' || t.Progress === 'In progress';
        return isValidProgress && taskDate && taskDate >= today && taskDate < tomorrow;
      }).sort((a, b) => {
        const dateA = a.date_started ? new Date(a.date_started).getTime() : 0;
        const dateB = b.date_started ? new Date(b.date_started).getTime() : 0;
        return dateA - dateB;
      }) || [];
      
      const selectedTask = activeTasks?.find(t => t.id === taskId);
      const currentTask = activeTasks?.find(t => t.Progress === 'In progress');
      
      if (!selectedTask) return;
      
      const currentTime = new Date();
      if (!currentTask || selectedTask.id === currentTask.id) {
        const {
          error: updateError
        } = await supabase.from('Tasks').update({
          Progress: 'In progress',
          date_started: currentTime.toISOString(),
          date_due: new Date(currentTime.getTime() + 25 * 60 * 1000).toISOString()
        }).eq('id', taskId);
        if (updateError) throw updateError;
      }
      
      // Get all time blocks for scheduling
      const timeBlocks = activeTasks
        ?.filter(t => isTaskTimeBlock(t))
        .map(t => ({
          start: new Date(t.date_started || ''),
          end: new Date(t.date_due || '')
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime()) || [];
      
      let nextStartTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
      
      for (const task of notStartedTasks) {
        if (task.id === taskId || currentTask && task.id === currentTask.id) continue;
        if (nextStartTime >= tomorrow) break;
        
        // Calculate duration for the task
        const taskDuration = 25 * 60 * 1000; // 25 minutes in milliseconds
        
        // Find the next available time slot that doesn't overlap with time blocks
        const taskStartTime = findNextAvailableTime(nextStartTime, taskDuration, timeBlocks);
        const taskEndTime = new Date(taskStartTime.getTime() + taskDuration);
        
        const {
          error
        } = await supabase.from('Tasks').update({
          date_started: taskStartTime.toISOString(),
          date_due: taskEndTime.toISOString()
        }).eq('id', task.id);
        
        if (error) throw error;
        
        nextStartTime = new Date(taskEndTime.getTime() + 5 * 60 * 1000);
      }
      
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['active-tasks']
      });
      toast.success('Timer started with selected task');
      setActiveTaskId(taskId);
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Failed to start task');
    }
  };
  
  const getTodayTasks = (tasks: Task[]): Task[] => {
    if (!tasks || tasks.length === 0) return [];
    
    // Filter out backlog tasks
    tasks = tasks.filter(task => task.Progress !== 'Backlog');
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const tomorrow5AM = new Date(tomorrow);
    tomorrow5AM.setHours(5, 0, 0, 0);
    
    if (now.getHours() >= 21) {
      return tasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        return taskDate >= today && taskDate <= tomorrow5AM;
      });
    } else {
      return tasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        return taskDate >= today && taskDate < tomorrow;
      });
    }
  };
  
  const handleShuffleTasks = async () => {
    if (onShuffleTasks) {
      return onShuffleTasks();
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
      
      // Preserve time blocks and only shuffle regular tasks
      const timeBlocksForScheduling = timeBlocks.map(t => ({
        start: new Date(t.date_started || ''),
        end: new Date(t.date_due || '')
      })).sort((a, b) => a.start.getTime() - b.start.getTime());
      
      let currentScheduleTime = startTime;
      
      for (const task of shuffledTasks) {
        if (currentTask && task.id === currentTask.id) continue;
        
        // Calculate task duration
        const taskDuration = 25 * 60 * 1000; // 25 minutes in milliseconds
        
        // Find next available time slot that doesn't overlap with time blocks
        const taskStartTime = findNextAvailableTime(currentScheduleTime, taskDuration, timeBlocksForScheduling);
        const taskEndTime = new Date(taskStartTime.getTime() + taskDuration);
        
        await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            Progress: task.id === currentTask?.id ? 'In progress' : 'Not started'
          })
          .eq('id', task.id);
        
        currentScheduleTime = new Date(taskEndTime.getTime() + 5 * 60 * 1000);
      }
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Tasks shuffled successfully');
    } catch (error) {
      console.error('Error shuffling tasks:', error);
      toast.error('Failed to shuffle tasks');
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
  
  // Filter out backlog tasks from active tasks for the UI
  const filteredActiveTasks = activeTasks ? activeTasks.filter(task => task.Progress !== 'Backlog') : [];
  
  return <div className="min-h-screen p-0 space-y-4 md:space-y-8 overflow-x-hidden" style={{
    background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)'
  }}>
      <div className="container mx-auto flex justify-between items-center py-4">
        <MenuBar />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate('/tasks')}>
              Task View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                <TaskListComponent 
                  tasks={filteredActiveTasks} 
                  onTaskStart={handleTaskStart} 
                  subtasks={[]} 
                  taskLists={taskLists} 
                  activeTaskId={activeTaskId}
                  expandedTasks={[]}
                  editingTaskId={null}
                  editingTaskName={''}
                  onToggleExpand={() => {}}
                  onEditStart={() => {}}
                  onEditCancel={() => {}}
                  onEditSave={() => {}}
                  onEditNameChange={() => {}}
                  onUpdateProgress={() => {}}
                  onMoveTask={() => {}}
                  onDeleteTask={() => {}}
                  onTimelineEdit={() => {}}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>;
};
