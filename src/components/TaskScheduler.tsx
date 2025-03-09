import React, { useState, useEffect } from 'react';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { PomodoroTimer } from './PomodoroTimer';
import { MenuBar } from './MenuBar';
import { Button } from './ui/button';
import { MoreVertical, Shuffle, Clock, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Task, Subtask } from '@/types/task.types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRecurringProjectsCheck } from '@/hooks/useRecurringProjectsCheck';
import { TimeBlockModal } from './TimeBlockModal';

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
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number>();
  const [isTimeBlockModalOpen, setIsTimeBlockModalOpen] = useState(false);
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
      } = await supabase.from('Tasks').select('*').in('Progress', ['Not started', 'In progress']).order('date_started', {
        ascending: true
      });
      if (error) throw error;
      return (data || []).filter(task => {
        return task.Progress && task.Progress !== 'Backlog';
      }) as Task[];
    }
  });
  
  const {
    data: subtasks
  } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('Subtasks').select('*');
      if (error) throw error;
      return data as Subtask[];
    }
  });
  
  const {
    data: timeBlocks
  } = useQuery({
    queryKey: ['time-blocks'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('Tasks').select('*').eq('Progress', 'Backlog').order('date_started', {
        ascending: true
      });
      if (error) throw error;
      return (data || []).filter(task => 
        task.details && typeof task.details === 'object' && task.details.isTimeBlock === true
      ) as Task[];
    }
  });
  
  useEffect(() => {
    if (activeTasks && activeTasks.length > 0) {
      setShowTimer(true);
      setTimerStarted(true);
      // Only set the first task as active if no current task is already active
      if (!activeTaskId || !activeTasks.some(task => task.id === activeTaskId)) {
        setActiveTaskId(activeTasks[0].id);
      }
    }
  }, [activeTasks, activeTaskId]);
  
  const handleTasksCreate = async (newTasks: NewTask[]) => {
    try {
      setTasks(newTasks);
      setShowTimer(true);
      setTimerStarted(true);
      setShowTaskForm(false);
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
      queryClient.invalidateQueries({
        queryKey: ['time-blocks']
      });
      toast.success('Tasks created successfully');
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast.error('Failed to create tasks');
    }
  };
  
  const handleTimeBlockCreate = async (timeBlock: {
    name: string;
    startDate: Date;
    duration: number;
  }) => {
    try {
      const endTime = new Date(timeBlock.startDate.getTime() + timeBlock.duration * 60 * 1000);
      
      const { data, error } = await supabase.from('Tasks').insert([{
        "Task Name": timeBlock.name,
        "Progress": "Backlog", // Use Backlog but with isTimeBlock flag in details
        "date_started": timeBlock.startDate.toISOString(),
        "date_due": endTime.toISOString(),
        "details": { isTimeBlock: true }
      }]).select().single();
      
      if (error) throw error;
      
      // Reschedule other tasks to avoid overlap with the new time block
      await rescheduleTasksAroundTimeBlocks();
      
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['active-tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['time-blocks']
      });
      
      toast.success('Time block created successfully');
      setIsTimeBlockModalOpen(false);
    } catch (error) {
      console.error('Error creating time block:', error);
      toast.error('Failed to create time block');
    }
  };
  
  const rescheduleTasksAroundTimeBlocks = async () => {
    try {
      // Fetch all time blocks and active tasks
      const { data: allTimeBlocks, error: timeBlocksError } = await supabase
        .from('Tasks')
        .select('*')
        .eq('Progress', 'Backlog')
        .order('date_started', { ascending: true });
      
      if (timeBlocksError) throw timeBlocksError;
      
      // Filter to include only true time blocks
      const timeBlockItems = (allTimeBlocks || []).filter(task => 
        task.details && typeof task.details === 'object' && task.details.isTimeBlock === true
      );
      
      const { data: allTasks, error: tasksError } = await supabase
        .from('Tasks')
        .select('*')
        .in('Progress', ['Not started', 'In progress'])
        .order('date_started', { ascending: true });
      
      if (tasksError) throw tasksError;
      
      if (!timeBlockItems || timeBlockItems.length === 0 || !allTasks) return;
      
      // Get the current "In progress" task
      const currentTask = allTasks.find(t => t.Progress === 'In progress');
      let startTime = currentTask 
        ? new Date(new Date(currentTask.date_due).getTime() + 5 * 60 * 1000) // 5 min after current task ends
        : new Date();
      
      // Sort all tasks except the current task
      const tasksToReschedule = allTasks
        .filter(t => {
          return (!t.details || typeof t.details !== 'object' || !t.details.isTimeBlock) && 
                 (!currentTask || t.id !== currentTask.id);
        })
        .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime());
      
      // Create sorted timeline of all blocks
      const timeline = [
        ...timeBlockItems.map(block => ({
          id: block.id,
          type: 'block',
          start: new Date(block.date_started),
          end: new Date(block.date_due)
        }))
      ];
      
      // Sort timeline by start time
      timeline.sort((a, b) => a.start.getTime() - b.start.getTime());
      
      // Schedule tasks around time blocks
      for (const task of tasksToReschedule) {
        // Check if this time overlaps with any time block
        let taskStart = new Date(startTime);
        let taskEnd = new Date(taskStart.getTime() + 25 * 60 * 1000); // 25 min task
        let needsReschedule = false;
        
        // Find conflicts with time blocks
        for (const block of timeline) {
          // Check if task overlaps with block
          if (
            (taskStart >= block.start && taskStart < block.end) || // task starts during block
            (taskEnd > block.start && taskEnd <= block.end) || // task ends during block
            (taskStart <= block.start && taskEnd >= block.end) // task spans the entire block
          ) {
            // Reschedule task to start after this block
            taskStart = new Date(block.end.getTime() + 5 * 60 * 1000); // 5 min buffer
            taskEnd = new Date(taskStart.getTime() + 25 * 60 * 1000);
            needsReschedule = true;
          }
        }
        
        if (needsReschedule || new Date(task.date_started).getTime() !== taskStart.getTime()) {
          // Update the task with new schedule
          await supabase.from('Tasks').update({
            date_started: taskStart.toISOString(),
            date_due: taskEnd.toISOString()
          }).eq('id', task.id);
        }
        
        // Move to next task start time
        startTime = new Date(taskEnd.getTime() + 5 * 60 * 1000); // 5 min break
      }
      
    } catch (error) {
      console.error('Error rescheduling tasks:', error);
      toast.error('Failed to reschedule tasks');
    }
  };
  
  const handleTaskStart = async (taskId: number) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const notStartedTasks = activeTasks?.filter(t => {
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
      
      // Don't allow time blocks to be started
      if (selectedTask.details && typeof selectedTask.details === 'object' && selectedTask.details.isTimeBlock === true) {
        toast.error("Time blocks cannot be started directly");
        return;
      }
      
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
      
      // After updating the current task, reschedule all tasks around time blocks
      await rescheduleTasksAroundTimeBlocks();
      
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['active-tasks']
      });
      toast.success('Timer started with selected task');
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Failed to start task');
    }
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
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      if (!tasks || tasks.length < 2) {
        toast.info('Not enough tasks to shuffle');
        return;
      }
      
      const todayTasks = getTodayTasks(tasks);
      if (todayTasks.length < 2) {
        toast.info('Not enough tasks to shuffle today');
        return;
      }
      
      const currentTask = todayTasks.find(t => t.Progress === 'In progress');
      // Get time blocks
      const { data: timeBlockData } = await supabase
        .from('Tasks')
        .select('*')
        .eq('Progress', 'Backlog')
        .order('date_started', { ascending: true });
        
      const timeBlocks = (timeBlockData || []).filter(t => 
        t.details && typeof t.details === 'object' && t.details.isTimeBlock === true
      );
      
      const tasksToShuffle = currentTask 
        ? todayTasks.filter(t => t.id !== currentTask.id && !(t.details && typeof t.details === 'object' && t.details.isTimeBlock === true))
        : todayTasks.filter(t => !(t.details && typeof t.details === 'object' && t.details.isTimeBlock === true)).slice(1);
      
      for (let i = tasksToShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tasksToShuffle[i], tasksToShuffle[j]] = [tasksToShuffle[j], tasksToShuffle[i]];
      }
      
      const shuffledTasks = currentTask 
        ? [currentTask, ...tasksToShuffle]
        : [...todayTasks.filter(t => !(t.details && typeof t.details === 'object' && t.details.isTimeBlock === true)).slice(0, 1), ...tasksToShuffle];
      
      // This part will be handled by rescheduleTasksAroundTimeBlocks()
      await rescheduleTasksAroundTimeBlocks();
      
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
                  autoStart={timerStarted}
                  activeTaskId={activeTaskId} 
                  onShuffleTasks={onShuffleTasks || handleShuffleTasks}
                />
              </div>}
              <div className="form-control">
                {showTaskForm ? (
                  <TaskForm onTasksCreate={handleTasksCreate} />
                ) : (
                  <div className="flex justify-center gap-3 py-4 px-[20px]">
                    <Button 
                      onClick={() => setShowTaskForm(true)} 
                      className="rounded-full shadow-lg"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Tasks
                    </Button>
                    <Button 
                      onClick={() => setIsTimeBlockModalOpen(true)} 
                      variant="outline"
                      className="rounded-full shadow-lg"
                    >
                      <Clock className="mr-1 h-4 w-4" />
                      Add Time Block
                    </Button>
                  </div>
                )}
              </div>
              <div className="task-list">
                <TaskList 
                  tasks={[...(activeTasks || []), ...(timeBlocks || [])]}
                  onTaskStart={handleTaskStart} 
                  subtasks={subtasks || []} 
                  taskLists={taskLists || []} 
                  activeTaskId={activeTaskId}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <TimeBlockModal 
        isOpen={isTimeBlockModalOpen} 
        onClose={() => setIsTimeBlockModalOpen(false)}
        onCreateTimeBlock={handleTimeBlockCreate}
      />
    </div>;
};
