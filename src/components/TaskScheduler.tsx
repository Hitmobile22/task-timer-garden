
import React, { useState, useEffect } from 'react';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { PomodoroTimer } from './PomodoroTimer';
import { MenuBar } from './MenuBar';
import { Button } from './ui/button';
import { MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface SubTask {
  name: string;
}

interface Task {
  name: string;
  subtasks: SubTask[];
}

export const TaskScheduler = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: activeTasks } = useQuery({
    queryKey: ['active-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .or('Progress.eq.In progress,Progress.eq.Not started')
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (activeTasks && activeTasks.length > 0) {
      setShowTimer(true);
      setTimerStarted(true);
      setActiveTaskId(activeTasks[0].id);
    }
  }, [activeTasks]);

  const handleTasksCreate = async (newTasks: Task[]) => {
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

  const handleTaskStart = (taskId: number) => {
    setActiveTaskId(taskId);
    setShowTimer(true);
    setTimerStarted(true);
  };

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-4xl flex justify-between items-center">
        <MenuBar />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/tasks')}>
              Task View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <main className="container mx-auto max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Task Scheduler</h1>
          <p className="text-white/80">Organize your time, maximize your productivity</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
          <div className="grid gap-8 md:grid-cols-[1fr,auto] items-start">
            <div className="space-y-6">
              {showTimer && (
                <div className="w-full animate-slideIn">
                  <PomodoroTimer 
                    tasks={tasks.map(t => t.name)} 
                    autoStart={timerStarted}
                    activeTaskId={activeTaskId}
                  />
                </div>
              )}
              <TaskForm onTasksCreate={handleTasksCreate} />
              <TaskList tasks={tasks} onTaskStart={handleTaskStart} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
