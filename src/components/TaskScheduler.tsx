import React, { useState, useEffect } from 'react';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { PomodoroTimer } from './PomodoroTimer';
import { MenuBar } from './MenuBar';
import { Button } from './ui/button';
import { Circle } from 'lucide-react';
import { MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { TASK_LIST_COLORS, DEFAULT_LIST_COLOR } from '@/constants/taskColors';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Task, Subtask } from '@/types/task.types';
import { useIsMobile } from '@/hooks/use-mobile';

interface SubTask {
  name: string;
}

interface NewTask {
  name: string;
  subtasks: SubTask[];
}

export const TaskScheduler = () => {
  const [tasks, setTasks] = useState<NewTask[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: taskLists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('TaskLists')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: activeTasks } = useQuery({
    queryKey: ['active-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .in('Progress', ['In progress', 'Not started'])
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      return (data || []).filter(task => {
        return task.Progress && task.Progress !== 'Backlog';
      }) as Task[];
    },
  });

  useEffect(() => {
    if (activeTasks && activeTasks.length > 0) {
      setShowTimer(true);
      setTimerStarted(true);
      setActiveTaskId(activeTasks[0].id);
    }
  }, [activeTasks]);

  const handleTasksCreate = async (newTasks: NewTask[]) => {
    try {
      setTasks(newTasks);
      setShowTimer(true);
      setTimerStarted(true);
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      
      toast.success('Tasks created successfully');
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast.error('Failed to create tasks');
    }
  };

  const handleTaskStart = async (taskId: number) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const notStartedTasks = activeTasks
          ?.filter(t => {
            const taskDate = t.date_started ? new Date(t.date_started) : null;
            const isValidProgress = t.Progress === 'Not started' || t.Progress === 'In progress';
            return isValidProgress &&
                taskDate &&
                taskDate >= today &&
                taskDate < tomorrow;
          })
          .sort((a, b) => {
            const dateA = a.date_started ? new Date(a.date_started).getTime() : 0;
            const dateB = b.date_started ? new Date(b.date_started).getTime() : 0;
            return dateA - dateB;
          }) || [];

      const selectedTask = activeTasks?.find(t => t.id === taskId);
      const currentTask = activeTasks?.find(t => t.Progress === 'In progress');

      if (!selectedTask) return;

      const currentTime = new Date();
      
      if (!currentTask || selectedTask.id === currentTask.id) {
        const { error: updateError } = await supabase
          .from('Tasks')
          .update({
            Progress: 'In progress',
            date_started: currentTime.toISOString(),
            date_due: new Date(currentTime.getTime() + 25 * 60 * 1000).toISOString()
          })
          .eq('id', taskId);

        if (updateError) throw updateError;
      }

      let nextStartTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
      
      for (const task of notStartedTasks) {
        if (task.id === taskId || (currentTask && task.id === currentTask.id)) continue;
        
        if (nextStartTime >= tomorrow) break;

        const taskStartTime = new Date(nextStartTime);
        const taskDueTime = new Date(taskStartTime.getTime() + 25 * 60 * 1000);
        
        const { error } = await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskDueTime.toISOString()
          })
          .eq('id', task.id);

        if (error) throw error;

        nextStartTime = new Date(taskStartTime.getTime() + 30 * 60 * 1000);
      }

      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Timer started with selected task');
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Failed to start task');
    }
  };

  const activeTaskListColor = activeTaskId && activeTasks && taskLists
    ? (() => {
        const activeTask = activeTasks.find(t => t.id === activeTaskId);
        if (!activeTask || activeTask.task_list_id === 1) return null;
        const taskList = taskLists.find(l => l.id === activeTask.task_list_id);
        return taskList?.color || null;
      })()
    : null;

  return (
    <div 
      className="min-h-screen p-4 md:p-6 space-y-6 md:space-y-8 overflow-x-hidden"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-[95%] md:max-w-4xl flex justify-between items-center">
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
      
      <main className="container mx-auto max-w-[95%] md:max-w-4xl space-y-6 md:space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Pomouroboros Timer</h1>
          <p className="text-sm md:text-base text-white/80">It really whips the ollama's ass</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-4 md:p-8 shadow-lg w-full">
          <div className="grid gap-6 md:gap-8 md:grid-cols-[1fr,auto] items-start">
            <div className="space-y-4 md:space-y-6 w-full">
              {showTimer && (
                <div 
                  className="w-full animate-slideIn rounded-lg overflow-hidden"
                  style={{
                    background: activeTaskListColor || undefined
                  }}
                >
                  <PomodoroTimer 
                    tasks={tasks.map(t => t.name)} 
                    autoStart={timerStarted}
                    activeTaskId={activeTaskId}
                  />
                </div>
              )}
              <TaskForm onTasksCreate={handleTasksCreate} />
              <TaskList 
                tasks={activeTasks || []}
                onTaskStart={handleTaskStart} 
                subtasks={[]}
                taskLists={taskLists}
                activeTaskId={activeTaskId}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
