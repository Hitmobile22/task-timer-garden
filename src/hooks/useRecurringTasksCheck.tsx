
import { useEffect, useState, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from '@tanstack/react-query';

export const useRecurringTasksCheck = () => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const isCheckingRef = useRef(false);
  const initialCheckDoneRef = useRef(false);

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
      // Prevent concurrent checks
      if (isCheckingRef.current) {
        console.log('Already checking recurring tasks, skipping...');
        return;
      }

      // Early morning check (before 7am don't generate tasks)
      const currentHour = new Date().getHours();
      if (currentHour < 7) {
        console.log('Before 7am, skipping task generation check');
        return;
      }

      if (settings && settings.length > 0) {
        try {
          isCheckingRef.current = true;
          console.log('Checking recurring tasks...');
          const { error } = await supabase.functions.invoke('check-recurring-tasks');
          if (error) throw error;
          
          // Update last checked time
          setLastChecked(new Date());
          console.log('Recurring tasks check completed at', new Date().toISOString());
        } catch (error) {
          console.error('Error checking recurring tasks:', error);
        } finally {
          isCheckingRef.current = false;
        }
      }
    };

    // Check on mount only once (not every time settings change)
    if (!initialCheckDoneRef.current && settings && settings.length > 0) {
      checkRecurringTasks();
      initialCheckDoneRef.current = true;
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
  }, [settings]);
};
