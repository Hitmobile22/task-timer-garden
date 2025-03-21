
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

export const useArchiveActions = () => {
  const queryClient = useQueryClient();

  // Archive a single task
  const archiveTask = useMutation({
    mutationFn: async (taskId: number) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ archived: true })
        .eq('id', taskId);
      
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task archived successfully');
    },
    onError: (error: any) => {
      console.error('Error archiving task:', error.message);
      toast.error('Failed to archive task');
    }
  });

  // Archive a project and all its tasks
  const archiveProject = useMutation({
    mutationFn: async (projectId: number) => {
      // Disable recurring settings
      await supabase
        .from('recurring_task_settings')
        .update({ enabled: false })
        .eq('project_id', projectId);

      // Archive project
      const { error: projectError } = await supabase
        .from('Projects')
        .update({ archived: true })
        .eq('id', projectId);

      if (projectError) throw new Error(projectError.message);
      
      // Archive tasks in the project
      const { error: tasksError } = await supabase
        .from('Tasks')
        .update({ archived: true })
        .eq('project_id', projectId);

      if (tasksError) throw new Error(tasksError.message);
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project archived successfully');
    },
    onError: (error: any) => {
      console.error('Error archiving project:', error.message);
      toast.error('Failed to archive project');
    }
  });

  // Archive a task list and all its tasks
  const archiveTaskList = useMutation({
    mutationFn: async (listId: number) => {
      // Disable recurring task settings
      await supabase
        .from('recurring_task_settings')
        .update({ enabled: false })
        .eq('task_list_id', listId);

      // Archive task list
      const { error: listError } = await supabase
        .from('TaskLists')
        .update({ archived: true })
        .eq('id', listId);

      if (listError) throw new Error(listError.message);
      
      // Archive tasks in the list
      const { error: tasksError } = await supabase
        .from('Tasks')
        .update({ archived: true })
        .eq('task_list_id', listId);

      if (tasksError) throw new Error(tasksError.message);
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task list archived successfully');
    },
    onError: (error: any) => {
      console.error('Error archiving task list:', error.message);
      toast.error('Failed to archive task list');
    }
  });

  // Archive all completed tasks
  const archiveCompletedTasks = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('Tasks')
        .update({ archived: true })
        .eq('Progress', 'Completed');

      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Completed tasks archived successfully');
    },
    onError: (error: any) => {
      console.error('Error archiving completed tasks:', error.message);
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
