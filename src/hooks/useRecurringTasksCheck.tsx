
import { useEffect, useState, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useRecurringTasksCheck = () => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const isCheckingRef = useRef(false);
  const queryClient = useQueryClient();
  const lastCheckTimeRef = useRef<number | null>(null);

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
        console.log('Already checking recurring tasks, skipping');
        return;
      }

      // Early morning check (before 7am don't generate tasks)
      const currentHour = new Date().getHours();
      if (currentHour < 7) {
        console.log('Before 7am, skipping task generation check');
        return;
      }
      
      // Prevent checking too frequently - once per hour is enough
      const now = new Date().getTime();
      if (lastCheckTimeRef.current && (now - lastCheckTimeRef.current < 60 * 60 * 1000)) {
        console.log('Tasks checked recently, skipping check');
        return;
      }

      if (settings && settings.length > 0) {
        try {
          isCheckingRef.current = true;
          console.log('Checking recurring tasks...');
          const { data, error } = await supabase.functions.invoke('check-recurring-tasks');
          
          if (error) throw error;
          
          console.log('Recurring tasks check result:', data);
          
          // Update last checked time
          setLastChecked(new Date());
          lastCheckTimeRef.current = now;
          
          // Invalidate tasks query to refresh the task list
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        } catch (error) {
          console.error('Error checking recurring tasks:', error);
        } finally {
          isCheckingRef.current = false;
        }
      }
    };

    // Check on mount if there are settings and we haven't checked recently
    const currentTime = new Date().getTime();
    const shouldCheckOnMount = 
      (!lastCheckTimeRef.current || 
      (currentTime - lastCheckTimeRef.current > 60 * 60 * 1000)) && 
      settings && 
      settings.length > 0;
      
    if (shouldCheckOnMount) {
      checkRecurringTasks();
    }

    // Set up an interval to check periodically (once per hour)
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
