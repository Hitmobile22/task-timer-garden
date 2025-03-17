
import { useEffect, useState, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentDayName, areDatesOnSameDay } from '@/lib/utils';
import { toast } from 'sonner';

export const useRecurringTasksCheck = () => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const queryClient = useQueryClient();
  const processingRef = useRef<Set<number>>(new Set());

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
          .select('task_list_id, created_at')
          .eq('enabled', true)
          .not('task_list_id', 'is', null)
          .contains('days_of_week', [dayOfWeek])
          .order('created_at', { ascending: false });
        
        if (uniqueListsError) {
          console.error('Error fetching unique task lists:', uniqueListsError);
          throw uniqueListsError;
        }
        
        // If no task lists have recurring settings enabled for today, return empty array
        if (!uniqueTaskLists || uniqueTaskLists.length === 0) {
          console.log('No recurring task settings for today:', dayOfWeek);
          return [];
        }
        
        // Get unique task list IDs (taking only the most recent for each list)
        const taskListsMap = new Map();
        uniqueTaskLists.forEach(item => {
          if (!item.task_list_id) return;
          
          if (!taskListsMap.has(item.task_list_id) || 
              new Date(item.created_at) > new Date(taskListsMap.get(item.task_list_id).created_at)) {
            taskListsMap.set(item.task_list_id, item);
          }
        });
        
        const uniqueTaskListIds = Array.from(taskListsMap.keys())
          .filter(id => id !== null && id !== undefined);
          
        console.log('Found recurring settings for task lists:', uniqueTaskListIds);
        
        // For each unique task list, get the most recent active setting
        const activeSettings = [];
        
        for (const taskListId of uniqueTaskListIds) {
          // Skip if taskListId is null or undefined
          if (taskListId === null || taskListId === undefined) {
            console.log('Skipping null or undefined task list ID');
            continue;
          }
          
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
    refetchInterval: 15 * 60 * 1000, // Refetch every 15 minutes
    refetchOnWindowFocus: false,
  });

  // Check if a generation log exists for today for a specific task list
  const checkGenerationLog = async (taskListId: number, settingId: number) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { data, error } = await supabase
        .from('recurring_task_generation_logs')
        .select('*')
        .eq('task_list_id', taskListId)
        .eq('setting_id', settingId)
        .gte('generation_date', today.toISOString())
        .lt('generation_date', tomorrow.toISOString())
        .maybeSingle();
        
      if (error) {
        console.error(`Error checking generation log for list ${taskListId}:`, error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in checkGenerationLog:', error);
      return null;
    }
  };

  useEffect(() => {
    const checkRecurringTasks = async () => {
      // Prevent concurrent checks
      if (isChecking) {
        console.log('Task check already in progress, skipping');
        return;
      }
      
      try {
        setIsChecking(true);
        
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
            
            // Create a filtered list excluding any task lists we're already processing
            // and task lists that already have generation logs for today
            const filteredSettings = [];
            
            for (const setting of settings) {
              if (!setting.task_list_id || processingRef.current.has(setting.task_list_id)) {
                continue;
              }
              
              // Check if we already have a generation log for today
              const generationLog = await checkGenerationLog(setting.task_list_id, setting.id);
              
              if (generationLog) {
                console.log(`Already generated ${generationLog.tasks_generated} tasks for list ${setting.task_list_id} today, skipping`);
                continue;
              }
              
              filteredSettings.push(setting);
              processingRef.current.add(setting.task_list_id);
            }
            
            if (filteredSettings.length === 0) {
              console.log('No task lists need processing, skipping check');
              return;
            }
            
            // Send only the critical information to the edge function
            const { data, error } = await supabase.functions.invoke('check-recurring-tasks', {
              body: { 
                forceCheck: false,
                settings: filteredSettings.map(s => ({
                  id: s.id,
                  task_list_id: s.task_list_id,
                  enabled: s.enabled,
                  daily_task_count: s.daily_task_count,
                  days_of_week: s.days_of_week
                }))
              }
            });
            
            // Clear the processing flags
            filteredSettings.forEach(s => {
              processingRef.current.delete(s.task_list_id);
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
            // Clear processing flags in case of error
            settings.forEach(s => {
              if (s.task_list_id) {
                processingRef.current.delete(s.task_list_id);
              }
            });
          }
        } else {
          console.log('No active recurring task settings found for today, skipping check');
        }
      } catch (error) {
        console.error('Error in checkRecurringTasks:', error);
      } finally {
        setIsChecking(false);
      }
    };

    // Check on mount if there are any enabled recurring task settings
    // and we haven't checked in the last hour
    if ((!lastChecked || 
        (new Date().getTime() - lastChecked.getTime() > 60 * 60 * 1000)) && 
        settings && settings.length > 0 && !isChecking) {
      checkRecurringTasks();
    }

    // Set up an interval to check periodically (every 3 hours instead of every hour)
    const interval = setInterval(() => {
      try {
        const currentHour = new Date().getHours();
        // Only check during daytime hours (7am-10pm)
        if (currentHour >= 7 && currentHour < 22 && !isChecking) {
          checkRecurringTasks();
        }
      } catch (error) {
        console.error('Error in interval check:', error);
      }
    }, 3 * 60 * 60 * 1000); // Check every 3 hours

    return () => clearInterval(interval);
  }, [settings, lastChecked, queryClient, isChecking]);
};
