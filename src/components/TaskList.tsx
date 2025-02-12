
import React from 'react';
import { Check } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface SubTask {
  name: string;
}

interface Task {
  name: string;
  subtasks: SubTask[];
}

interface TaskListProps {
  tasks: Task[];
}

export const TaskList: React.FC<TaskListProps> = ({ tasks: initialTasks }) => {
  const queryClient = useQueryClient();

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Task updated');
    },
  });

  if (!dbTasks || dbTasks.length === 0) return null;

  return (
    <div className="space-y-4 animate-slideIn">
      <h2 className="text-lg font-semibold">Your Tasks</h2>
      <ul className="space-y-4">
        {dbTasks.map((task) => (
          <li key={task.id} className="space-y-2">
            <div 
              className={`flex items-center gap-3 p-3 rounded-md bg-white/50 hover:bg-white/80 transition-colors cursor-pointer ${
                task.Progress === 'Completed' ? 'opacity-50' : ''
              }`}
              onClick={() => {
                if (task.Progress !== 'Completed') {
                  updateTaskProgress.mutate({ id: task.id });
                }
              }}
            >
              <span className={`flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full ${
                task.Progress === 'Completed' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-primary/10 text-primary'
              }`}>
                <Check className="h-4 w-4" />
              </span>
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
