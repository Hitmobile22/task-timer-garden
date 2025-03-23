
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

// Define a simple type for the response
interface ArchiveResponse {
  success: boolean;
}

export const useArchiveActions = () => {
  const queryClient = useQueryClient();

  // Define mutation functions separately to avoid excessive type instantiation
  const archiveTaskFn = async (taskId: number): Promise<ArchiveResponse> => {
    const { error } = await supabase
      .from('Tasks')
      .update({ archived: true })
      .eq('id', taskId);
    
    if (error) throw new Error(error.message);
    return { success: true };
  };

  // Archive a single task
  const archiveTask = useMutation({
    mutationFn: archiveTaskFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task archived successfully');
    },
    onError: (error: Error) => {
      console.error('Archive task error:', error);
      toast.error('Failed to archive task');
    }
  });

  // Define project archive function separately
  const archiveProjectFn = async (projectId: number): Promise<ArchiveResponse> => {
    // First disable recurring settings
    await supabase
      .from('Projects')
      .update({ isRecurring: false })
      .eq('id', projectId);

    // Then archive project
    const { error: projectError } = await supabase
      .from('Projects')
      .update({ archived: true })
      .eq('id', projectId);

    if (projectError) throw new Error(projectError.message);
    
    // Finally archive tasks in the project
    const { error: tasksError } = await supabase
      .from('Tasks')
      .update({ archived: true })
      .eq('project_id', projectId);

    if (tasksError) throw new Error(tasksError.message);
    
    return { success: true };
  };

  // Archive a project and all its tasks
  const archiveProject = useMutation({
    mutationFn: archiveProjectFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project archived successfully');
    },
    onError: (error: Error) => {
      console.error('Archive project error:', error);
      toast.error('Failed to archive project');
    }
  });

  // Define task list archive function separately
  const archiveTaskListFn = async (listId: number): Promise<ArchiveResponse> => {
    // First disable recurring task settings
    await supabase
      .from('recurring_task_settings')
      .update({ enabled: false })
      .eq('task_list_id', listId);

    // Then archive task list
    const { error: listError } = await supabase
      .from('TaskLists')
      .update({ archived: true })
      .eq('id', listId);

    if (listError) throw new Error(listError.message);
    
    // Finally archive tasks in the list
    const { error: tasksError } = await supabase
      .from('Tasks')
      .update({ archived: true })
      .eq('task_list_id', listId);

    if (tasksError) throw new Error(tasksError.message);
    
    return { success: true };
  };

  // Archive a task list and all its tasks
  const archiveTaskList = useMutation({
    mutationFn: archiveTaskListFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task list archived successfully');
    },
    onError: (error: Error) => {
      console.error('Archive task list error:', error);
      toast.error('Failed to archive task list');
    }
  });

  // Define completed tasks archive function separately
  const archiveCompletedTasksFn = async (): Promise<ArchiveResponse> => {
    const { error } = await supabase
      .from('Tasks')
      .update({ archived: true })
      .eq('Progress', 'Completed');

    if (error) throw new Error(error.message);
    return { success: true };
  };

  // Archive all completed tasks
  const archiveCompletedTasks = useMutation({
    mutationFn: archiveCompletedTasksFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Completed tasks archived successfully');
    },
    onError: (error: Error) => {
      console.error('Archive completed tasks error:', error);
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
