
import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const useRecurringTasksCheck = () => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  // Query for active recurring task settings
  const { data: settings } = useQuery({
    queryKey: ['recurring-task-settings'],
    queryFn: async () => {
      // Get the current day of week
      const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      
      // Get only the most recent enabled setting for each task list that includes today's day of week
      const { data: uniqueTaskLists, error: uniqueListsError } = await supabase
        .from('recurring_task_settings')
        .select('task_list_id')
        .eq('enabled', true)
        .contains('days_of_week', [dayOfWeek]);
      
      if (uniqueListsError) throw uniqueListsError;
      
      // If no task lists have recurring settings enabled for today, return empty array
      if (!uniqueTaskLists || uniqueTaskLists.length === 0) {
        return [];
      }
      
      // Get unique task list IDs
      const uniqueTaskListIds = [...new Set(uniqueTaskLists.map(item => item.task_list_id))];
      
      // For each unique task list, get the most recent active setting
      const activeSettings = [];
      
      for (const taskListId of uniqueTaskListIds) {
        const { data, error } = await supabase
          .from('recurring_task_settings')
          .select('*')
          .eq('enabled', true)
          .eq('task_list_id', taskListId)
          .contains('days_of_week', [dayOfWeek])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        if (data && data.length > 0) {
          activeSettings.push(data[0]);
        }
      }
      
      return activeSettings;
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
      
      // Prevent checking too frequently - once per hour is enough
      if (lastChecked) {
        const timeSinceLastCheck = new Date().getTime() - lastChecked.getTime();
        if (timeSinceLastCheck < 60 * 60 * 1000) { // less than 1 hour
          console.log('Tasks checked recently, skipping check');
          return;
        }
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
    // and we haven't checked in the last hour
    if ((!lastChecked || 
        (new Date().getTime() - lastChecked.getTime() > 60 * 60 * 1000)) && 
        settings && settings.length > 0) {
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
