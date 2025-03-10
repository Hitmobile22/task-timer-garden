
import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useRecurringTasksCheck = () => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const queryClient = useQueryClient();

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
      // Early morning check (before 7am don't generate tasks)
      const currentHour = new Date().getHours();
      if (currentHour < 7) {
        console.log('Before 7am, skipping task generation check');
        return;
      }

      if (settings && settings.length > 0) {
        try {
          console.log('Checking recurring tasks...');
          const { data, error } = await supabase.functions.invoke('check-recurring-tasks');
          
          if (error) throw error;
          
          console.log('Recurring tasks check result:', data);
          
          // Update last checked time
          setLastChecked(new Date());
          
          // Invalidate tasks query to refresh the task list
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        } catch (error) {
          console.error('Error checking recurring tasks:', error);
        }
      }
    };

    // Check on mount if there are any enabled recurring task settings
    if (!lastChecked && settings && settings.length > 0) {
      checkRecurringTasks();
    }

    // Also set up an interval to check periodically (once per hour)
    const interval = setInterval(() => {
      const currentHour = new Date().getHours();
      // Only check during daytime hours (7am-10pm)
      if (currentHour >= 7 && currentHour < 22) {
        checkRecurringTasks();
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(interval);
  }, [settings, lastChecked, queryClient]);
};
