
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentDayName, getTodayISOString, getTomorrowISOString } from '@/lib/utils';
import { toast } from 'sonner';

// Global check state to prevent multiple instances from running checks simultaneously
let isGlobalCheckInProgress = false;
const lastGlobalCheck = new Map<number, Date>();
// Global map to track the last check time for any task list to prevent multiple checks
const lastFullCheck = {
  timestamp: new Date(0),
  inProgress: false
};

export const useRecurringTasksCheck = () => {
  const [isLocalChecking, setIsLocalChecking] = useState(false);
  const queryClient = useQueryClient();
  const processingRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef<boolean>(false);

  // Query for active recurring task settings
  const { data: settings } = useQuery({
    queryKey: ['recurring-task-settings'],
    queryFn: async () => {
      try {
        // Get the current day of week
        const dayOfWeek = getCurrentDayName();
        console.log(`Fetching recurring task settings for ${dayOfWeek}`);
        
        // Get unique task list IDs with enabled settings for today
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
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    refetchOnWindowFocus: false,
    staleTime: 15 * 60 * 1000, // Data is fresh for 15 minutes
  });

  // Check if a generation log exists for today for a specific task list
  const checkGenerationLog = useCallback(async (taskListId: number, settingId: number) => {
    try {
      // Use the utility functions for consistent date handling
      const today = getTodayISOString();
      const tomorrow = getTomorrowISOString();
      
      const { data, error } = await supabase
        .from('recurring_task_generation_logs')
        .select('*')
        .eq('task_list_id', taskListId)
        .eq('setting_id', settingId)
        .gte('generation_date', today)
        .lt('generation_date', tomorrow)
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
  }, []);

  // The main checking function
  const checkRecurringTasks = useCallback(async (forceCheck = false) => {
    // Prevent concurrent checks globally across instances
    if (isGlobalCheckInProgress || lastFullCheck.inProgress) {
      console.log('Global task check already in progress, skipping');
      return;
    }
    
    // Implement rate limiting for the global check (prevent checking more than once every 15 minutes)
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - lastFullCheck.timestamp.getTime();
    const rateLimitMs = 15 * 60 * 1000; // 15 minutes
    
    if (!forceCheck && timeSinceLastCheck < rateLimitMs) {
      console.log(`Rate limiting global check - last checked ${Math.round(timeSinceLastCheck / 1000 / 60)} minutes ago`);
      return;
    }
    
    try {
      // Set the global and local check flags
      isGlobalCheckInProgress = true;
      lastFullCheck.inProgress = true;
      lastFullCheck.timestamp = now;
      setIsLocalChecking(true);
      
      // Early morning check (before 7am don't generate tasks)
      const currentHour = new Date().getHours();
      if (currentHour < 7 && !forceCheck) {
        console.log('Before 7am, skipping task generation check');
        return;
      }
      
      // Get the current day name for logging
      const currentDayName = getCurrentDayName();
      console.log(`Running recurring task check on ${currentDayName}`);
      
      if (settings && settings.length > 0) {
        try {
          console.log('Checking recurring tasks...');
          console.log('Active recurring task settings:', settings.length);
          
          // Create a filtered list excluding any task lists we're already processing
          // and task lists that already have generation logs for today
          const filteredSettings = [];
          
          for (const setting of settings) {
            if (!setting.task_list_id) {
              continue;
            }
            
            // Debug log the days of week for this setting
            console.log(`Task list ${setting.task_list_id} scheduled days:`, setting.days_of_week);
            
            // Explicitly check if today's day is in the days_of_week array
            if (!setting.days_of_week.includes(currentDayName) && !forceCheck) {
              console.log(`Task list ${setting.task_list_id} not scheduled for today (${currentDayName}), skipping`);
              continue;
            }
            
            // Skip if we're already processing this task list
            if (processingRef.current.has(setting.task_list_id)) {
              console.log(`Already processing list ${setting.task_list_id}, skipping`);
              continue;
            }
            
            // Skip if we're rate-limited for this task list
            const lastCheck = lastGlobalCheck.get(setting.task_list_id);
            if (!forceCheck && lastCheck && (now.getTime() - lastCheck.getTime()) < rateLimitMs) {
              console.log(`Rate limiting check for list ${setting.task_list_id}, last checked ${Math.round((now.getTime() - lastCheck.getTime()) / 1000 / 60)} minutes ago`);
              continue;
            }
            
            // Check if we already have a generation log for today
            const generationLog = await checkGenerationLog(setting.task_list_id, setting.id);
            
            if (generationLog && !forceCheck) {
              console.log(`Already generated ${generationLog.tasks_generated} tasks for list ${setting.task_list_id} today, skipping`);
              continue;
            }
            
            filteredSettings.push(setting);
            processingRef.current.add(setting.task_list_id);
            lastGlobalCheck.set(setting.task_list_id, now);
          }
          
          if (filteredSettings.length === 0) {
            console.log('No task lists need processing, skipping check');
            return;
          }
          
          // Send only the critical information to the edge function
          const { data, error } = await supabase.functions.invoke('check-recurring-tasks', {
            body: { 
              forceCheck: forceCheck,
              settings: filteredSettings.map(s => ({
                id: s.id,
                task_list_id: s.task_list_id,
                enabled: s.enabled,
                daily_task_count: s.daily_task_count,
                days_of_week: s.days_of_week
              })),
              currentDay: currentDayName
            }
          });
          
          // Clear the processing flags
          filteredSettings.forEach(s => {
            if (s.task_list_id) {
              processingRef.current.delete(s.task_list_id);
            }
          });
          
          if (error) {
            console.error('Error response from recurring tasks check:', error);
            throw error;
          }
          
          console.log('Recurring tasks check result:', data);
          
          // Invalidate tasks query to refresh the task list if new tasks were created
          const tasksCreated = data.results.some(result => result.status === 'created');
          if (tasksCreated) {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
          }
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
      setIsLocalChecking(false);
      isGlobalCheckInProgress = false;
      lastFullCheck.inProgress = false;
    }
  }, [settings, queryClient, checkGenerationLog]);

  useEffect(() => {
    // Run an initial check when settings are first loaded, but only once per component instance
    if (settings && settings.length > 0 && !isLocalChecking && !isGlobalCheckInProgress && !mountedRef.current) {
      mountedRef.current = true;
      checkRecurringTasks();
    }
  }, [settings, checkRecurringTasks, isLocalChecking]);

  useEffect(() => {
    // Set up an interval to check once per hour during daytime hours (7am-10pm)
    const interval = setInterval(() => {
      try {
        const currentHour = new Date().getHours();
        // Only check during daytime hours (7am-10pm) and if no check is already in progress
        if (currentHour >= 7 && currentHour < 22 && !isLocalChecking && !isGlobalCheckInProgress) {
          checkRecurringTasks();
        }
      } catch (error) {
        console.error('Error in interval check:', error);
      }
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(interval);
  }, [checkRecurringTasks, isLocalChecking]);

  return {
    checkRecurringTasks,
    isChecking: isLocalChecking
  };
};
