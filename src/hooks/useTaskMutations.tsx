
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Task } from '@/types/task.types';
import { toast } from "sonner";

export const useTaskMutations = () => {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const { error } = await supabase
        .from('Tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete task');
      console.error('Delete error:', error);
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ taskId, progress, isSubtask = false }: { taskId: number; progress: Task['Progress']; isSubtask?: boolean }) => {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ Progress: progress })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Progress updated');
    },
    onError: (error) => {
      toast.error('Failed to update progress');
      console.error('Update error:', error);
    },
  });

  const updateTaskNameMutation = useMutation({
    mutationFn: async ({ taskId, taskName, isSubtask = false }: { taskId: number; taskName: string; isSubtask?: boolean }) => {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ "Task Name": taskName })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Task name updated');
    },
    onError: (error) => {
      toast.error('Failed to update task name');
      console.error('Update error:', error);
    },
  });

  const updateTaskTimelineMutation = useMutation({
    mutationFn: async ({ taskId, start, end }: { taskId: number; start: Date; end: Date }) => {
      const { error } = await supabase
        .from('Tasks')
        .update({
          date_started: start.toISOString(),
          date_due: end.toISOString()
        })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task timeline updated');
    },
    onError: (error) => {
      toast.error('Failed to update task timeline');
      console.error('Update error:', error);
    },
  });

  const archiveTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const { data: task, error: fetchError } = await supabase
        .from('Tasks')
        .select('archived')
        .eq('id', taskId)
        .single();
      
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('Tasks')
        .update({ archived: !task?.archived })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task archive status updated');
    },
  });

  return {
    deleteMutation,
    updateProgressMutation,
    updateTaskNameMutation,
    updateTaskTimelineMutation,
    archiveTaskMutation
  };
};
