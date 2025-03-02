
import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

export const useRecurringTasksCheck = () => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

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
          const { error } = await supabase.functions.invoke('check-recurring-tasks');
          if (error) throw error;
          
          // Update last checked time
          setLastChecked(new Date());
        } catch (error) {
          console.error('Error checking recurring tasks:', error);
        }
      }
    };

    // Check on mount if there are any enabled recurring task settings
    // Only check once when component mounts or settings change
    if (!lastChecked) {
      checkRecurringTasks();
    }

    // Also set up an interval to check periodically (every hour instead of 15 minutes)
    const interval = setInterval(() => {
      const currentHour = new Date().getHours();
      // Only check during daytime hours (7am-10pm)
      if (currentHour >= 7 && currentHour < 22) {
        checkRecurringTasks();
      }
    }, 60 * 60 * 1000); // Check every hour instead of every 15 minutes

    return () => clearInterval(interval);
  }, [settings, lastChecked]);
};
