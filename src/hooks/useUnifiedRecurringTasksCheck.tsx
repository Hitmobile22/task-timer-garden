
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getCurrentDayName } from '@/lib/utils';

// Global state for the hook to prevent multiple instances from running concurrently
let isGlobalChecking = false;
const lastGlobalCheck = new Date(0);

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
  details?: any; // Added the optional details property to fix the TypeScript error
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
  
  const countActiveTasks = async (taskListId: number) => {
    try {
      const { data, error } = await supabase
        .from('Tasks')
        .select('id')
        .eq('task_list_id', taskListId)
        .in('Progress', ['Not started', 'In progress']);
        
      if (error) {
        console.error(`Error counting active tasks for list ${taskListId}:`, error);
        return 0;
      }
      
      return data?.length || 0;
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
    const timeSinceLastCheck = now.getTime() - lastGlobalCheck.getTime();
    const minInterval = 5 * 60 * 1000;
    
    if (!forceCheck && timeSinceLastCheck < minInterval) {
      console.log(`Last recurring tasks check was ${Math.round(timeSinceLastCheck / 1000 / 60)} minutes ago, skipping`);
      return;
    }
    
    try {
      isGlobalChecking = true;
      setIsChecking(true);
      const currentCheckId = ++checkCountRef.current;
      activeCheckIdRef.current = currentCheckId;
      
      console.log(`Reset ${currentCheckId} daily goals`);
      
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
      
      // More strict filtering - ensure proper string comparison by trimming whitespace
      const relevantSettings = settings.filter(s => {
        if (!s.enabled || s.daily_task_count <= 0) return false;
        
        // More explicit day of week checking with improved logging
        const hasMatchingDay = Array.isArray(s.days_of_week) && 
                              s.days_of_week.some(day => 
                                day.trim().toLowerCase() === currentDay.trim().toLowerCase());
        
        console.log(`Task list ${s.task_list_id} configured days: [${s.days_of_week?.join(', ')}], includes ${currentDay}? ${hasMatchingDay}`);
        
        return hasMatchingDay || forceCheck;
      });
      
      if (relevantSettings.length === 0) {
        console.log(`No recurring task settings for ${currentDay}, skipping check`);
        return;
      }
      
      let tasksCreated = false;
      
      for (const setting of relevantSettings) {
        if (activeCheckIdRef.current !== currentCheckId) {
          console.log(`Check #${currentCheckId} was superseded by newer check #${activeCheckIdRef.current}, aborting settings loop`);
          break;
        }
        
        console.log(`Active recurring setting for task list ${setting.task_list_id}: ${JSON.stringify(setting, null, 2)}`);
        console.log(`Configured days: ${setting.days_of_week.join(', ')}, Today: ${currentDay}`);
        
        // Double check the day matching using the exact same logic
        const dayMatches = Array.isArray(setting.days_of_week) && 
                          setting.days_of_week.some(day => 
                            day.trim().toLowerCase() === currentDay.trim().toLowerCase());
        
        if (!dayMatches && !forceCheck) {
          console.log(`Task list ${setting.task_list_id} is not configured for today (${currentDay}), skipping`);
          continue;
        }
        
        const existingLog = await getGenerationLog(setting.task_list_id, setting.id);
        
        if (!forceCheck && existingLog) {
          console.log(`Already generated ${existingLog.tasks_generated} tasks for list ${setting.task_list_id} today, skipping`);
          continue;
        }
        
        const activeTaskCount = await countActiveTasks(setting.task_list_id);
        console.log(`Task list ${setting.task_list_id} has ${activeTaskCount} active tasks of ${setting.daily_task_count} goal`);
        
        const additionalListTasksToCreate = Math.max(0, setting.daily_task_count - activeTaskCount);
        
        if (additionalListTasksToCreate > 0) {
          console.log(`Creating ${additionalListTasksToCreate} tasks for list ${setting.task_list_id} directly`);
          
          try {
            const { data, error } = await supabase.functions.invoke('check-recurring-tasks', {
              body: {
                specificListId: setting.task_list_id,
                forceCheck: forceCheck,
                targetTaskCount: setting.daily_task_count,
                currentTaskCount: activeTaskCount,
                currentDay: currentDay
              }
            });
            
            if (error) {
              console.error(`Error calling recurring tasks function for list ${setting.task_list_id}:`, error);
              continue;
            }
            
            console.log(`Edge function result for list ${setting.task_list_id}:`, data);
            
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
        }
      }
      
      if (tasksCreated) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        
        if (!forceCheck) {
          toast.success('Created new recurring tasks for today');
        }
      }
      
      lastGlobalCheck.setTime(now.getTime());
      setLastCheckedTime(now);
    } catch (error) {
      console.error('Error checking recurring tasks:', error);
      toast.error('Error checking recurring tasks');
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
