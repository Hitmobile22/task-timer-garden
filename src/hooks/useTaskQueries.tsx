
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Task, Subtask, Project } from '@/types/task.types';

export const useTaskQueries = () => {
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Projects')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      console.log('Projects query result:', data); // Debug log
      return data as Project[];
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('order', { ascending: true });
      
      if (error) throw error;
      console.log('Tasks query result:', data); // Debug log
      return data as Task[];
    },
  });

  const { data: subtasks, isLoading: subtasksLoading } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      if (!tasks || tasks.length === 0) return [];
      
      const taskIds = tasks.map(task => task.id);
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .in('Parent Task ID', taskIds);
      
      if (error) throw error;
      console.log('Subtasks query result:', data); // Debug log
      return data as Subtask[];
    },
    enabled: !!tasks?.length,
  });

  const { data: taskLists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('TaskLists')
        .select('*')
        .order('order', { ascending: true });
      
      if (error) throw error;
      console.log('TaskLists query result:', data); // Debug log
      return data;
    },
  });

  return {
    projects,
    tasks,
    subtasks,
    taskLists,
    isLoading: tasksLoading || projectsLoading || subtasksLoading
  };
};
