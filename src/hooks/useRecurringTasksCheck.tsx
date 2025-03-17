
import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { areDatesOnSameDay, getCurrentDayName } from '@/lib/utils';

export const useRecurringTasksCheck = () => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  // Query for active recurring task settings
  const { data: settings } = useQuery({
    queryKey: ['recurring-task-settings'],
    queryFn: async () => {
      try {
        // Get the current day of week
        const dayOfWeek = getCurrentDayName();
        console.log(`Fetching recurring task settings for ${dayOfWeek}`);
        
        // Get only the most recent enabled setting for each task list that includes today's day of week
        const { data: uniqueTaskLists, error: uniqueListsError } = await supabase
          .from('recurring_task_settings')
          .select('task_list_id')
          .eq('enabled', true)
          .not('task_list_id', 'is', null) // Avoid null task_list_id values
          .contains('days_of_week', [dayOfWeek]);
        
        if (uniqueListsError) {
          console.error('Error fetching unique task lists:', uniqueListsError);
          throw uniqueListsError;
        }
        
        // If no task lists have recurring settings enabled for today, return empty array
        if (!uniqueTaskLists || uniqueTaskLists.length === 0) {
          console.log('No recurring task settings for today:', dayOfWeek);
          return [];
        }
        
        // Get unique task list IDs
        const uniqueTaskListIds = [...new Set(uniqueTaskLists.map(item => item.task_list_id))].filter(id => id !== null);
        console.log('Found recurring settings for task lists:', uniqueTaskListIds);
        
        // For each unique task list, get the most recent active setting
        const activeSettings = [];
        
        for (const taskListId of uniqueTaskListIds) {
          // Only fetch enabled settings
          const { data, error } = await supabase
            .from('recurring_task_settings')
            .select('*')
            .eq('enabled', true)
            .eq('task_list_id', taskListId)
            .contains('days_of_week', [dayOfWeek])
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (error) {
            console.error(`Error fetching settings for task list ${taskListId}:`, error);
            throw error;
          }
          
          if (data && data.length > 0) {
            console.log(`Active recurring setting for task list ${taskListId}:`, data[0]);
            activeSettings.push(data[0]);
          }
        }
        
        return activeSettings;
      } catch (error) {
        console.error('Error in recurring task settings query:', error);
        return [];
      }
    },
  });

  useEffect(() => {
    const checkRecurringTasks = async () => {
      try {
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
            console.log('Active recurring task settings:', settings.length);
            
            // Provide detailed settings info to the edge function to help with debugging
            const { data, error } = await supabase.functions.invoke('check-recurring-tasks', {
              body: { 
                forceCheck: true,
                settings: settings.map(s => ({
                  id: s.id,
                  task_list_id: s.task_list_id,
                  enabled: s.enabled,
                  daily_task_count: s.daily_task_count,
                  days_of_week: s.days_of_week
                }))
              }
            });
            
            if (error) {
              console.error('Error response from recurring tasks check:', error);
              throw error;
            }
            
            console.log('Recurring tasks check result:', data);
            
            // Update last checked time
            setLastChecked(new Date());
            
            // Invalidate tasks query to refresh the task list
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
          } catch (error) {
            console.error('Error checking recurring tasks:', error);
          }
        } else {
          console.log('No active recurring task settings found for today, skipping check');
        }
      } catch (error) {
        console.error('Error in checkRecurringTasks:', error);
      }
    };

    // Check on mount if there are any enabled recurring task settings
    // and we haven't checked in the last hour
    if ((!lastChecked || 
        (new Date().getTime() - lastChecked.getTime() > 60 * 60 * 1000)) && 
        settings && settings.length > 0) {
      checkRecurringTasks();
    }

    // Set up an interval to check periodically (every 3 hours instead of every hour)
    const interval = setInterval(() => {
      try {
        const currentHour = new Date().getHours();
        // Only check during daytime hours (7am-10pm)
        if (currentHour >= 7 && currentHour < 22) {
          checkRecurringTasks();
        }
      } catch (error) {
        console.error('Error in interval check:', error);
      }
    }, 3 * 60 * 60 * 1000); // Check every 3 hours

    return () => clearInterval(interval);
  }, [settings, lastChecked, queryClient]);
};
