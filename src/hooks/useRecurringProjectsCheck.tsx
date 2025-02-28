
import { useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

// Define explicit type for project data to avoid deep type instantiation
type RecurringProject = {
  id: number;
  name: string;
  startDate?: string;
  dueDate?: string;
  progress: string;
  isRecurring: boolean;
  recurringTaskCount?: number;
  task_list_id?: number;
};

export const useRecurringProjectsCheck = () => {
  const { data: projects } = useQuery<RecurringProject[]>({
    queryKey: ['recurring-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Projects')
        .select('*')
        .eq('isRecurring', true)
        .neq('progress', 'Completed');
      
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    const checkRecurringProjects = async () => {
      if (projects && projects.length > 0) {
        try {
          const { error } = await supabase.functions.invoke('check-recurring-projects');
          if (error) throw error;
        } catch (error) {
          console.error('Error checking recurring projects:', error);
        }
      }
    };

    // Check on mount if there are any enabled recurring projects
    checkRecurringProjects();

    // Also set up an interval to check once per day (at app load)
    const oneDay = 24 * 60 * 60 * 1000;
    const interval = setInterval(checkRecurringProjects, oneDay);

    return () => clearInterval(interval);
  }, [projects]);
};
