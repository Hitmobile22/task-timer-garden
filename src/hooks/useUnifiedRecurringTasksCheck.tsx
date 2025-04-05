
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCurrentDayName } from '@/lib/utils';
import { 
  hasTaskListBeenGeneratedToday, 
  setTaskListGenerated, 
  isDayMatch 
} from '@/utils/recurringUtils';

// Global state for the hook to prevent multiple instances from running concurrently
let isGlobalChecking = false;
const lastGlobalCheck = new Date(0);
// Add a cache to prevent duplicate generation within the same session
const generationCache = new Map<number, Date>();

interface RecurringTaskSettings {
  id: number;
  task_list_id: number;
  enabled: boolean;
  daily_task_count: number;
  days_of_week: string[];
  created_at: string;
  updated_at: string;
  archived: boolean;
}

interface GenerationLog {
  id: number;
  task_list_id: number;
  setting_id: number;
  generation_date: string;
  tasks_generated: number;
  details?: any;
  project_id?: number;
}

export const useUnifiedRecurringTasksCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const checkCountRef = useRef(0);
  const activeCheckIdRef = useRef<number | null>(null);
  
  const logGenerationActivity = async (
    taskListId: number, 
    settingId: number, 
    tasksGenerated: number,
    details?: any
  ) => {
    try {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('recurring_task_generation_logs')
        .insert({
          task_list_id: taskListId,
          setting_id: settingId,
          generation_date: now.toISOString(),
          tasks_generated: tasksGenerated,
          details: details
        })
        .select('id')
        .single();
        
      if (error) {
        console.error('Error logging task generation activity:', error);
        return null;
      }
      
      // Also update the in-memory cache to prevent duplicate generation
      setTaskListGenerated(taskListId, now);
      
      return data;
    } catch (error) {
      console.error('Error in logGenerationActivity:', error);
      return null;
    }
  };
  
  const getRecurringTasksSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('recurring_task_settings')
        .select(`
          id,
          task_list_id,
          enabled,
          daily_task_count,
          days_of_week,
          created_at,
          updated_at,
          archived
        `)
        .eq('archived', false)
        .eq('enabled', true)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error('Error fetching recurring task settings:', error);
        throw error;
      }
      
      const settingsByList = new Map<number, RecurringTaskSettings>();
      data?.forEach((setting) => {
        if (!settingsByList.has(setting.task_list_id)) {
          settingsByList.set(setting.task_list_id, setting);
        }
      });
      
      return Array.from(settingsByList.values());
    } catch (error) {
      console.error('Error in getRecurringTasksSettings:', error);
      return [];
    }
  };
  
  const getGenerationLog = async (taskListId: number, settingId: number) => {
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
        console.error(`Error fetching generation log for list ${taskListId}:`, error);
        return null;
      }
      
      return data as GenerationLog | null;
    } catch (error) {
      console.error('Error in getGenerationLog:', error);
      return null;
    }
  };
  
  // Improved function to count ONLY active tasks plus any tasks generated today (even if completed)
  const countActiveTasks = async (taskListId: number, settingId: number) => {
    try {
      // Get today's date bounds
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Count active tasks in the list (Not Started or In Progress)
      const { data: activeTasks, error: activeError } = await supabase
        .from('Tasks')
        .select('id')
        .eq('task_list_id', taskListId)
        .in('Progress', ['Not started', 'In progress']);
      
      if (activeError) {
        console.error(`Error counting active tasks for list ${taskListId}:`, activeError);
        return 0;
      }
      
      // Get the number of tasks already generated today (even if they're completed)
      // This is critical to avoid regenerating tasks that were completed earlier today
      const { data: generationLogs, error: logError } = await supabase
        .from('recurring_task_generation_logs')
        .select('tasks_generated')
        .eq('task_list_id', taskListId)
        .eq('setting_id', settingId)
        .gte('generation_date', today.toISOString())
        .lt('generation_date', tomorrow.toISOString())
        .maybeSingle();
      
      if (logError) {
        console.error(`Error getting generation logs for list ${taskListId}:`, logError);
      }
      
      // Count tasks that were completed today but were generated as part of recurring tasks
      const { data: completedTodayTasks, error: completedError } = await supabase
        .from('Tasks')
        .select('id')
        .eq('task_list_id', taskListId)
        .eq('Progress', 'Completed')
        .gte('date_completed', today.toISOString())
        .lt('date_completed', tomorrow.toISOString());
      
      if (completedError) {
        console.error(`Error counting completed tasks for list ${taskListId}:`, completedError);
      }
      
      const activeCount = activeTasks?.length || 0;
      const tasksAlreadyGeneratedToday = generationLogs?.tasks_generated || 0;
      const completedTodayCount = completedTodayTasks?.length || 0;
      
      // Total tasks to consider = active tasks + completed tasks from today
      const totalRelevantTaskCount = activeCount + completedTodayCount;
      
      console.log(`List ${taskListId} task counts: active=${activeCount}, completedToday=${completedTodayCount}, previouslyGenerated=${tasksAlreadyGeneratedToday}`);
      
      return Math.max(totalRelevantTaskCount, tasksAlreadyGeneratedToday);
    } catch (error) {
      console.error('Error in countActiveTasks:', error);
      return 0;
    }
  };
  
  const checkRecurringTasks = useCallback(async (forceCheck = false) => {
    if (isGlobalChecking || isChecking) {
      console.log('Already checking recurring tasks, skipping');
      return;
    }
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const timeSinceLastCheck = now.getTime() - lastGlobalCheck.getTime();
    const minInterval = 5 * 60 * 1000; // 5 minutes
    
    if (!forceCheck && timeSinceLastCheck < minInterval) {
      console.log(`Last recurring tasks check was ${Math.round(timeSinceLastCheck / 1000 / 60)} minutes ago, skipping`);
      return;
    }
    
    try {
      isGlobalChecking = true;
      setIsChecking(true);
      const currentCheckId = ++checkCountRef.current;
      activeCheckIdRef.current = currentCheckId;
      
      console.log(`Starting check #${currentCheckId} for recurring tasks`);
      
      const currentDay = getCurrentDayName();
      console.log(`Running unified recurring task check on ${currentDay}`);
      
      const settings = await getRecurringTasksSettings();
      
      if (!settings || settings.length === 0) {
        console.log('No active recurring task settings found, skipping check');
        return;
      }
      
      if (activeCheckIdRef.current !== currentCheckId) {
        console.log(`Check #${currentCheckId} was superseded by newer check #${activeCheckIdRef.current}, aborting`);
        return;
      }
      
      // Filter settings to only include those that should run today
      const relevantSettings = settings.filter(s => {
        if (!s.enabled || s.daily_task_count <= 0) return false;
        
        // First check our in-memory cache
        if (!forceCheck && hasTaskListBeenGeneratedToday(s.task_list_id)) {
          console.log(`Task list ${s.task_list_id} already generated today (cached), skipping`);
          return false;
        }
        
        // Use our improved day matching function
        const dayMatches = isDayMatch(currentDay, s.days_of_week);
        
        console.log(`List ${s.task_list_id} days: [${s.days_of_week.join(', ')}], current day: ${currentDay}, matches: ${dayMatches}`);
        
        return dayMatches || forceCheck;
      });
      
      if (relevantSettings.length === 0) {
        console.log(`No recurring task settings for ${currentDay} or all already processed, skipping check`);
        return;
      }
      
      let tasksCreated = false;
      
      for (const setting of relevantSettings) {
        if (activeCheckIdRef.current !== currentCheckId) {
          console.log(`Check #${currentCheckId} was superseded by newer check #${activeCheckIdRef.current}, aborting settings loop`);
          break;
        }
        
        // Check database generation log as secondary validation
        const existingLog = await getGenerationLog(setting.task_list_id, setting.id);
        
        if (!forceCheck && existingLog) {
          console.log(`Already generated ${existingLog.tasks_generated} tasks for list ${setting.task_list_id} today (database), skipping`);
          
          // Update in-memory cache
          setTaskListGenerated(setting.task_list_id, new Date());
          continue;
        }
        
        // IMPROVED: Count active tasks AND tasks completed today AND previously generated tasks
        const totalTaskCount = await countActiveTasks(setting.task_list_id, setting.id);
        console.log(`Task list ${setting.task_list_id} has ${totalTaskCount} relevant tasks of ${setting.daily_task_count} goal`);
        
        // Only create additional tasks if we have fewer relevant tasks than the daily goal
        const additionalTasksToCreate = Math.max(0, setting.daily_task_count - totalTaskCount);
        
        if (additionalTasksToCreate > 0) {
          console.log(`Creating ${additionalTasksToCreate} tasks for list ${setting.task_list_id}`);
          
          try {
            const { data, error } = await supabase.functions.invoke('check-recurring-tasks', {
              body: {
                specificListId: setting.task_list_id,
                forceCheck: forceCheck,
                targetTaskCount: setting.daily_task_count,
                currentTaskCount: totalTaskCount,
                additionalTasksNeeded: additionalTasksToCreate,
                currentDay: currentDay
              }
            });
            
            if (error) {
              console.error(`Error calling recurring tasks function for list ${setting.task_list_id}:`, error);
              continue;
            }
            
            console.log(`Edge function result for list ${setting.task_list_id}:`, data);
            
            // Update in-memory cache to prevent duplicates in this session
            setTaskListGenerated(setting.task_list_id, new Date());
            
            const generationLog = await getGenerationLog(setting.task_list_id, setting.id);
            
            if (generationLog) {
              const newTaskCount = (generationLog.tasks_generated || 0) + (data?.tasksCreated || 0);
              
              await supabase
                .from('recurring_task_generation_logs')
                .update({ 
                  tasks_generated: newTaskCount,
                  details: { ...generationLog.details, lastCheck: new Date().toISOString() }
                })
                .eq('id', generationLog.id);
              
              console.log(`Updated generation log for list ${setting.task_list_id} to ${newTaskCount} tasks`);
            } else if (data?.tasksCreated > 0) {
              await logGenerationActivity(
                setting.task_list_id,
                setting.id,
                data.tasksCreated,
                { createdAt: new Date().toISOString() }
              );
              console.log(`Created generation log for list ${setting.task_list_id} with ${data.tasksCreated} tasks`);
            }
            
            if (data?.tasksCreated > 0) {
              tasksCreated = true;
            }
          } catch (fnError) {
            console.error(`Error processing recurring tasks for list ${setting.task_list_id}:`, fnError);
          }
        } else {
          console.log(`No need to create tasks for list ${setting.task_list_id}`);
          // Update in-memory cache even when no tasks were created
          setTaskListGenerated(setting.task_list_id, new Date());
          
          // Also log in the database to prevent further checks today
          if (!existingLog) {
            await logGenerationActivity(
              setting.task_list_id,
              setting.id,
              0,
              { note: "No additional tasks needed", createdAt: new Date().toISOString() }
            );
          }
        }
      }
      
      if (tasksCreated) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        
        if (!forceCheck) {
          toast('Created new recurring tasks for today');
        }
      }
      
      lastGlobalCheck.setTime(now.getTime());
      setLastCheckedTime(now);
    } catch (error) {
      console.error('Error checking recurring tasks:', error);
      toast('Error checking recurring tasks');
    } finally {
      isGlobalChecking = false;
      setIsChecking(false);
      
      if (activeCheckIdRef.current !== checkCountRef.current) {
        console.log(`Check #${activeCheckIdRef.current} cleanup completed`);
      }
    }
  }, [queryClient]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      checkRecurringTasks(false);
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [checkRecurringTasks]);
  
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const currentHour = new Date().getHours();
        
        if (currentHour >= 8 && currentHour < 22) {
          checkRecurringTasks(false);
        }
      } catch (error) {
        console.error('Error in recurring tasks interval check:', error);
      }
    }, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkRecurringTasks]);
  
  return {
    checkRecurringTasks,
    isChecking,
    lastCheckedTime,
    forceCheck: () => checkRecurringTasks(true)
  };
};

