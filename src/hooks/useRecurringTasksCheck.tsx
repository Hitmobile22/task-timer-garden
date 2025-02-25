
import { useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

export const useRecurringTasksCheck = () => {
  const { data: settings } = useQuery({
    queryKey: ['recurring-task-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_task_settings')
        .select('*')
        .eq('enabled', true);
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const checkRecurringTasks = async () => {
      if (settings && settings.length > 0) {
        try {
          const { error } = await supabase.functions.invoke('check-recurring-tasks');
          if (error) throw error;
        } catch (error) {
          console.error('Error checking recurring tasks:', error);
        }
      }
    };

    // Check on mount if there are any enabled recurring task settings
    checkRecurringTasks();

    // Also set up an interval to check periodically (every 15 minutes)
    const interval = setInterval(checkRecurringTasks, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, [settings]);
};
