import React, { useState } from 'react';
import { Check, Filter, Play } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from './ui/button';

interface SubTask {
  name: string;
}

interface Task {
  name: string;
  subtasks: SubTask[];
}

interface TaskListProps {
  tasks: Task[];
  onTaskStart?: (taskId: number) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks: initialTasks, onTaskStart }) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const isTaskView = location.pathname === '/tasks';

  const { data: dbTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: dbSubtasks } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const updateTaskProgress = useMutation({
    mutationFn: async ({ id, isSubtask = false }: { id: number; isSubtask?: boolean }) => {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ Progress: 'Completed' })
        .eq('id', id);
      
      if (error) throw error;

      if (!isSubtask) {
        await updateRemainingTaskTimes();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task completed');
    },
  });

  const updateRemainingTaskTimes = async () => {
    try {
      const notStartedTasks = dbTasks?.filter(t => t.Progress === 'Not started') || [];
      
      if (notStartedTasks.length === 0) return;

      const currentTime = new Date();
      
      for (let i = 0; i < notStartedTasks.length; i++) {
        const task = notStartedTasks[i];
        const taskStartTime = new Date(currentTime);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + (i * 30));
        
        const taskDueTime = new Date(taskStartTime);
        taskDueTime.setMinutes(taskDueTime.getMinutes() + 25);

        const { error } = await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskDueTime.toISOString()
          })
          .eq('id', task.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating task times:', error);
      toast.error('Failed to update task times');
    }
  };

  const handleTaskStart = async (taskId: number) => {
    try {
      const notStartedTasks = dbTasks?.filter(t => t.Progress === 'Not started') || [];
      const selectedTask = dbTasks?.find(t => t.id === taskId);
      
      if (!selectedTask) return;

      const otherTasks = notStartedTasks.filter(t => t.id !== taskId);
      const orderedTasks = [selectedTask, ...otherTasks];

      const currentTime = new Date();
      
      for (let i = 0; i < orderedTasks.length; i++) {
        const task = orderedTasks[i];
        const taskStartTime = new Date(currentTime);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + (i * 30));
        
        const taskDueTime = new Date(taskStartTime);
        taskDueTime.setMinutes(taskDueTime.getMinutes() + 25);

        const { error } = await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskDueTime.toISOString()
          })
          .eq('id', task.id);

        if (error) throw error;
      }

      onTaskStart?.(taskId);
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Timer started with selected task');
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Failed to start task');
    }
  };

  if (!dbTasks || dbTasks.length === 0) return null;

  const filteredTasks = dbTasks.filter(task => {
    if (!isTaskView) {
      return task.Progress !== 'Completed';
    }
    
    switch (filter) {
      case 'active':
        return task.Progress !== 'Completed';
      case 'completed':
        return task.Progress === 'Completed';
      default:
        return true;
    }
  });

  return (
    <div className="space-y-4 animate-slideIn">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Your Tasks</h2>
        {isTaskView && (
          <Select
            value={filter}
            onValueChange={(value: 'all' | 'active' | 'completed') => setFilter(value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter tasks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="active">Active Tasks</SelectItem>
              <SelectItem value="completed">Completed Tasks</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      <ul className="space-y-4">
        {filteredTasks.map((task) => (
          <li key={task.id} className="space-y-2">
            <div 
              className={`flex items-center gap-3 p-3 rounded-md bg-white/50 hover:bg-white/80 transition-colors ${
                task.Progress === 'Completed' ? 'opacity-50' : ''
              }`}
            >
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  className={`flex-shrink-0 h-6 w-6 rounded-full ${
                    task.Progress === 'Completed' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-primary/10 text-primary hover:bg-primary/20'
                  }`}
                  onClick={() => {
                    if (task.Progress !== 'Completed') {
                      updateTaskProgress.mutate({ id: task.id });
                    }
                  }}
                >
                  <Check className="h-4 w-4" />
                </Button>
                {task.Progress !== 'Completed' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => handleTaskStart(task.id)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <span className={`flex-grow font-medium ${
                task.Progress === 'Completed' ? 'line-through' : ''
              }`}>
                {task["Task Name"]}
              </span>
            </div>
            {dbSubtasks && dbSubtasks.filter(st => st["Parent Task ID"] === task.id).length > 0 && (
              <ul className="pl-8 space-y-2">
                {dbSubtasks
                  .filter(subtask => subtask["Parent Task ID"] === task.id)
                  .map((subtask) => (
                    <li
                      key={subtask.id}
                      className={`flex items-center gap-3 p-2 rounded-md bg-white/30 hover:bg-white/50 transition-colors cursor-pointer ${
                        subtask.Progress === 'Completed' ? 'opacity-50' : ''
                      }`}
                      onClick={() => {
                        if (subtask.Progress !== 'Completed') {
                          updateTaskProgress.mutate({ id: subtask.id, isSubtask: true });
                        }
                      }}
                    >
                      <span className={`flex-shrink-0 h-5 w-5 flex items-center justify-center rounded-full ${
                        subtask.Progress === 'Completed'
                          ? 'bg-green-500 text-white'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        <Check className="h-3 w-3" />
                      </span>
                      <span className={`flex-grow text-sm ${
                        subtask.Progress === 'Completed' ? 'line-through' : ''
                      }`}>
                        {subtask["Task Name"]}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
