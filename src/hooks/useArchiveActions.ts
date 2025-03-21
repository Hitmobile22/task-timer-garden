
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

export const useArchiveActions = () => {
  const queryClient = useQueryClient();

  const archiveTask = useMutation({
    mutationFn: async (taskId: number) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ archived: true })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task archived successfully');
    },
    onError: (error: any) => {
      console.error('Error archiving task:', error);
      toast.error('Failed to archive task');
    }
  });

  const archiveProject = useMutation({
    mutationFn: async (projectId: number) => {
      // Disable recurring settings
      await supabase
        .from('recurring_task_settings')
        .update({ enabled: false })
        .eq('project_id', projectId);

      // Archive project and its tasks
      const { error: projectError } = await supabase
        .from('Projects')
        .update({ archived: true })
        .eq('id', projectId);

      const { error: tasksError } = await supabase
        .from('Tasks')
        .update({ archived: true })
        .eq('project_id', projectId);

      if (projectError || tasksError) throw projectError || tasksError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project archived successfully');
    },
    onError: (error: any) => {
      console.error('Error archiving project:', error);
      toast.error('Failed to archive project');
    }
  });

  const archiveTaskList = useMutation({
    mutationFn: async (listId: number) => {
      // Disable recurring task settings
      await supabase
        .from('recurring_task_settings')
        .update({ enabled: false })
        .eq('task_list_id', listId);

      // Archive task list and its tasks
      const { error: listError } = await supabase
        .from('TaskLists')
        .update({ archived: true })
        .eq('id', listId);

      const { error: tasksError } = await supabase
        .from('Tasks')
        .update({ archived: true })
        .eq('task_list_id', listId);

      if (listError || tasksError) throw listError || tasksError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task list archived successfully');
    },
    onError: (error: any) => {
      console.error('Error archiving task list:', error);
      toast.error('Failed to archive task list');
    }
  });

  const archiveCompletedTasks = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('Tasks')
        .update({ archived: true })
        .eq('Progress', 'Completed');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Completed tasks archived successfully');
    },
    onError: (error: any) => {
      console.error('Error archiving completed tasks:', error);
      toast.error('Failed to archive completed tasks');
    }
  });

  return {
    archiveTask,
    archiveProject,
    archiveTaskList,
    archiveCompletedTasks
  };
};
