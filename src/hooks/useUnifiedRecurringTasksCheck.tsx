
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

// Track the last day we reset daily goals
let lastDailyGoalResetDay = new Date(0);

export const useUnifiedRecurringTasksCheck = () => {
  const [isLocalChecking, setIsLocalChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const processingRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef<boolean>(false);
  const projectsCheckCompletedRef = useRef<boolean>(false);
  const checkRequestId = useRef<number>(0);

  // Query for active recurring task settings - Task Lists
  const { data: listSettings } = useQuery({
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
        
        console.log(`Found ${uniqueTaskLists.length} task lists with recurring settings for today`);
        
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
          
          // Only fetch enabled settings for today's day
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
            // Double-check that current day is in days_of_week array (extra validation)
            if (data[0].days_of_week.includes(dayOfWeek)) {
              console.log(`Active recurring setting for task list ${taskListId}:`, data[0]);
              console.log(`Configured days: ${data[0].days_of_week.join(', ')}, Today: ${dayOfWeek}`);
              activeSettings.push(data[0]);
            } else {
              console.log(`Task list ${taskListId} does not include today (${dayOfWeek}) in days of week:`, data[0].days_of_week);
            }
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

  // Query for active recurring projects
  const { data: projects } = useQuery({
    queryKey: ['recurring-projects'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('Projects')
          .select('*')
          .eq('isRecurring', true)
          .neq('progress', 'Completed');
          
        if (error) throw error;
        
        console.log(`Found ${data?.length || 0} active recurring projects`);
        if (data && data.length > 0) {
          data.forEach(project => {
            console.log(`Recurring Project: ${project.id} (${project['Project Name']}) due: ${project.date_due}`);
          });
        }
        
        return data || [];
      } catch (error) {
        console.error('Error fetching recurring projects:', error);
        return [];
      }
    },
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    refetchOnWindowFocus: false,
    staleTime: 15 * 60 * 1000, // Data is fresh for 15 minutes
  });

  // Function to check if daily goals need to be reset
  const checkAndResetDailyGoals = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only reset once per day
    if (lastDailyGoalResetDay.toDateString() === today.toDateString()) {
      console.log('Daily goals already reset today, skipping');
      return false;
    }
    
    try {
      console.log('Checking if daily goals need to be reset');
      
      // Call the edge function to reset daily goals
      const { data, error } = await supabase.functions.invoke('check-recurring-projects', {
        body: {
          resetDailyGoals: true,
          forceCheck: false,
          projects: [] // Empty array as we're just resetting goals
        }
      });
      
      if (error) {
        console.error('Error resetting daily goals:', error);
        return false;
      }
      
      if (data && data.success) {
        console.log(`Reset ${data.goalsReset || 0} daily goals`);
        lastDailyGoalResetDay = today;
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['daily-project-goals'] });
        queryClient.invalidateQueries({ queryKey: ['project-goals'] });
        
        if (data.goalsReset > 0) {
          toast.info(`Reset ${data.goalsReset} daily goals for a new day`);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in checkAndResetDailyGoals:', error);
      return false;
    }
  }, [queryClient]);

  // Check if a generation log exists for today
  const checkGenerationLog = useCallback(async (taskListId: number | null = null, projectId: number | null = null, settingId: number | null = null) => {
    try {
      // Use the utility functions for consistent date handling
      const today = getTodayISOString();
      const tomorrow = getTomorrowISOString();
      
      const query = supabase
        .from('recurring_task_generation_logs')
        .select('*')
        .gte('generation_date', today)
        .lt('generation_date', tomorrow);
      
      // Filter based on what we're checking
      if (taskListId !== null) {
        query.eq('task_list_id', taskListId);
      }
      
      if (projectId !== null) {
        query.eq('project_id', projectId);
      }
      
      if (settingId !== null) {
        query.eq('setting_id', settingId);
      }
      
      const { data, error } = await query.maybeSingle();
        
      if (error) {
        console.error(`Error checking generation log:`, error);
        return null;
      }
      
      if (data) {
        if (projectId) {
          console.log(`Found generation log for project ${projectId}: ${data.tasks_generated} tasks on ${data.generation_date}`);
        } else if (taskListId) {
          console.log(`Found generation log for task list ${taskListId}: ${data.tasks_generated} tasks on ${data.generation_date}`);
        }
      } else {
        if (projectId) {
          console.log(`No generation log found for project ${projectId} today`);
        } else if (taskListId) {
          console.log(`No generation log found for task list ${taskListId} today`);
        }
      }
      
      return data;
    } catch (error) {
      console.error('Error in checkGenerationLog:', error);
      return null;
    }
  }, []);

  // The main checking function for both task lists and projects
  const checkRecurringTasks = useCallback(async (forceCheck = false) => {
    // Prevent concurrent checks globally across instances
    if (isGlobalCheckInProgress || lastFullCheck.inProgress) {
      console.log('Global task check already in progress, skipping');
      return;
    }
    
    // Create a unique ID for this check request
    const thisCheckId = ++checkRequestId.current;
    
    // Implement rate limiting for the global check
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - lastFullCheck.timestamp.getTime();
    const rateLimitMs = 15 * 60 * 1000; // 15 minutes
    
    if (!forceCheck && timeSinceLastCheck < rateLimitMs) {
      console.log(`Rate limiting global check - last checked ${Math.round(timeSinceLastCheck / 1000 / 60)} minutes ago`);
      return;
    }
    
    try {
      // First check if daily goals need to be reset (new day)
      await checkAndResetDailyGoals();
    
      // Set the global and local check flags
      isGlobalCheckInProgress = true;
      lastFullCheck.inProgress = true;
      lastFullCheck.timestamp = now;
      setIsLocalChecking(true);
      projectsCheckCompletedRef.current = false;
      
      // Early morning check (before 7am don't generate tasks)
      const currentHour = new Date().getHours();
      if (currentHour < 7 && !forceCheck) {
        console.log('Before 7am, skipping task generation check');
        return;
      }
      
      // Get the current day name for logging
      const currentDayName = getCurrentDayName();
      console.log(`Running unified recurring task check on ${currentDayName}`);

      // First check recurring projects - their tasks should be generated first
      if (projects && projects.length > 0) {
        await checkRecurringProjects(projects, currentDayName, forceCheck);
        projectsCheckCompletedRef.current = true;
      } else {
        console.log('No active recurring projects found, skipping check');
        projectsCheckCompletedRef.current = true;
      }
      
      // If this check was superceded by a newer check, abort
      if (thisCheckId !== checkRequestId.current) {
        console.log(`Check #${thisCheckId} was superseded by newer check #${checkRequestId.current}, aborting`);
        return;
      }
      
      // Then check recurring task lists, which should consider tasks already created by projects
      if (listSettings && listSettings.length > 0) {
        // Brief delay to ensure project task generation has completed
        setTimeout(async () => {
          // Make sure this check request is still valid
          if (thisCheckId !== checkRequestId.current) {
            console.log(`Delayed check #${thisCheckId} was superseded by newer check #${checkRequestId.current}, aborting`);
            return;
          }
          
          const settingsForToday = listSettings.filter(setting => 
            setting.days_of_week && 
            Array.isArray(setting.days_of_week) && 
            setting.days_of_week.includes(currentDayName)
          );
          
          if (settingsForToday.length > 0) {
            console.log(`Found ${settingsForToday.length} settings active for today (${currentDayName})`);
            await checkRecurringTaskLists(settingsForToday, currentDayName, forceCheck);
          } else {
            console.log(`No task list settings configured for today (${currentDayName})`);
          }
        }, 2000);
      } else {
        console.log('No active recurring task list settings found for today, skipping check');
      }
      
      // Update last checked time
      setLastChecked(now);
      
    } catch (error) {
      console.error('Error in unified recurring tasks check:', error);
    } finally {
      // Only reset the global flags if this is still the current check
      if (thisCheckId === checkRequestId.current) {
        setIsLocalChecking(false);
        isGlobalCheckInProgress = false;
        lastFullCheck.inProgress = false;
      } else {
        console.log(`Check #${thisCheckId} cleanup skipped as it was superseded`);
      }
    }
  }, [listSettings, projects, checkGenerationLog, checkAndResetDailyGoals]);

  // Check recurring projects
  const checkRecurringProjects = useCallback(async (projects, currentDayName, forceCheck) => {
    try {
      console.log(`Checking ${projects.length} recurring projects...`);
      
      const now = new Date();
      const rateLimitMs = 15 * 60 * 1000; // 15 minutes
      const filteredProjects = [];
      
      for (const project of projects) {
        // Skip if we're already processing this project
        if (processingRef.current.has(project.id)) {
          console.log(`Already processing project ${project.id}, skipping`);
          continue;
        }
        
        // Skip if we're rate-limited for this project
        const lastCheck = lastGlobalCheck.get(project.id);
        if (!forceCheck && lastCheck && (now.getTime() - lastCheck.getTime()) < rateLimitMs) {
          console.log(`Rate limiting check for project ${project.id}, last checked ${Math.round((now.getTime() - lastCheck.getTime()) / 1000 / 60)} minutes ago`);
          continue;
        }
        
        // Verify project due date is valid
        const dueDate = project.date_due ? new Date(project.date_due) : null;
        const startDate = project.date_started ? new Date(project.date_started) : null;
        
        if (dueDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            console.log(`Project ${project.id} (${project['Project Name']}) due date ${dueDate.toISOString()} is in the past, updating name if needed`);
            
            // Only mark as overdue if not already marked
            if (!project['Project Name'].includes('(overdue)')) {
              try {
                const { error } = await supabase
                  .from('Projects')
                  .update({ 'Project Name': `${project['Project Name']} (overdue)` })
                  .eq('id', project.id);
                
                if (error) {
                  console.error(`Error updating overdue project ${project.id}:`, error);
                } else {
                  console.log(`Marked project ${project.id} as overdue`);
                }
              } catch (err) {
                console.error(`Error updating overdue project:`, err);
              }
            }
          }
        }
        
        // Check for existing generation log
        const generationLog = await checkGenerationLog(null, project.id);
        
        if (generationLog && !forceCheck) {
          console.log(`Already generated ${generationLog.tasks_generated} tasks for project ${project.id} today, skipping`);
          continue;
        }
        
        // Check how many active tasks already exist for this project
        const { data: existingActiveTasks, error: countError } = await supabase
          .from('Tasks')
          .select('id, "Task Name"')
          .eq('project_id', project.id)
          .in('Progress', ['Not started', 'In progress']);
          
        if (countError) {
          console.error(`Error counting active tasks for project ${project.id}:`, countError);
          continue;
        }
        
        const existingCount = existingActiveTasks?.length || 0;
        const taskGoal = project.recurringTaskCount || 1;
        
        console.log(`Project ${project.id} (${project['Project Name']}) has ${existingCount} active tasks of ${taskGoal} goal`);
        
        // If we already have enough active tasks, skip this project
        if (existingCount >= taskGoal && !forceCheck) {
          console.log(`Project ${project.id} already has enough active tasks (${existingCount}/${taskGoal}), skipping`);
          continue;
        }
        
        console.log(`Adding project ${project.id} (${project['Project Name']}) to filtered list for task generation`);
        filteredProjects.push(project);
        processingRef.current.add(project.id);
        lastGlobalCheck.set(project.id, now);
      }
      
      if (filteredProjects.length === 0) {
        console.log('No projects need processing, skipping check');
        return;
      }
      
      console.log(`Sending ${filteredProjects.length} projects to edge function for task generation`);
      
      // Send the projects to the check-recurring-projects function
      const { data, error } = await supabase.functions.invoke('check-recurring-projects', {
        body: {
          forceCheck: forceCheck,
          dayOfWeek: currentDayName,
          projects: filteredProjects.map(p => ({
            id: p.id,
            "Project Name": p["Project Name"],
            task_list_id: p.task_list_id,
            isRecurring: p.isRecurring,
            recurringTaskCount: p.recurringTaskCount,
            date_started: p.date_started,
            date_due: p.date_due,
            progress: p.progress
          }))
        }
      });
      
      // Clear the processing flags
      filteredProjects.forEach(p => {
        processingRef.current.delete(p.id);
      });
      
      if (error) {
        console.error('Error response from recurring projects check:', error);
        throw error;
      }
      
      console.log('Recurring projects check result:', data);
      
      // Invalidate tasks query to refresh the task list if new tasks were created
      const tasksCreated = data?.results?.some(result => result.status === 'created');
      if (tasksCreated) {
        console.log('Tasks were created, invalidating task queries');
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        
        toast.success('Created new recurring tasks from projects');
      } else {
        console.log('No tasks were created by the recurring projects check');
      }
    } catch (error) {
      console.error('Error checking recurring projects:', error);
      toast.error('Error checking recurring projects');
      // Clear processing flags in case of error
      if (projects) {
        projects.forEach(p => {
          processingRef.current.delete(p.id);
        });
      }
    }
  }, [checkGenerationLog, queryClient]);

  // Check recurring task lists
  const checkRecurringTaskLists = useCallback(async (settings, currentDayName, forceCheck) => {
    try {
      console.log('Checking recurring task lists...');
      console.log('Active recurring task list settings:', settings.length);
      
      // Wait for projects check to complete
      if (!projectsCheckCompletedRef.current) {
        console.log('Waiting for projects check to complete before processing task lists...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Create a filtered list excluding any task lists we're already processing
      // and task lists that already have generation logs for today
      const filteredSettings = [];
      const now = new Date();
      const rateLimitMs = 15 * 60 * 1000; // 15 minutes
      
      for (const setting of settings) {
        if (!setting.task_list_id) {
          continue;
        }
        
        // Debug log the days of week for this setting
        console.log(`Task list ${setting.task_list_id} scheduled days:`, setting.days_of_week);
        
        // Explicitly check if today's day is in the days_of_week array
        if (!setting.days_of_week || !Array.isArray(setting.days_of_week) || !setting.days_of_week.includes(currentDayName)) {
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
        const generationLog = await checkGenerationLog(setting.task_list_id, null, setting.id);
        
        if (generationLog && !forceCheck) {
          console.log(`Already generated ${generationLog.tasks_generated} tasks for list ${setting.task_list_id} today, skipping`);
          continue;
        }
        
        // Check how many active tasks already exist for this list
        const { data: activeTasks, error: countError } = await supabase
          .from('Tasks')
          .select('id, "Task Name", project_id')
          .eq('task_list_id', setting.task_list_id)
          .in('Progress', ['Not started', 'In progress']);
          
        if (countError) {
          console.error(`Error counting active tasks for list ${setting.task_list_id}:`, countError);
          continue;
        }
        
        const existingCount = activeTasks?.length || 0;
        const dailyGoal = setting.daily_task_count || 1;
        
        console.log(`Task list ${setting.task_list_id} has ${existingCount} active tasks of ${dailyGoal} goal`);
        
        // If we already have enough active tasks, skip this list (unless forced)
        if (existingCount >= dailyGoal && !forceCheck) {
          console.log(`Task list ${setting.task_list_id} already has enough active tasks (${existingCount}/${dailyGoal}), skipping`);
          
          // Record that we already have enough tasks
          await updateGenerationLog(supabaseClient, setting.task_list_id, setting.id, existingCount);
          continue;
        }
        
        console.log(`Adding task list ${setting.task_list_id} to filtered list for task generation`);
        filteredSettings.push(setting);
        processingRef.current.add(setting.task_list_id);
        lastGlobalCheck.set(setting.task_list_id, now);
      }
      
      if (filteredSettings.length === 0) {
        console.log('No task lists need processing, skipping check');
        return;
      }
      
      console.log(`Sending ${filteredSettings.length} task lists to edge function for task generation`);
      
      // Send only the critical information to the edge function
      const { data, error } = await supabase.functions.invoke('check-recurring-tasks', {
        body: { 
          forceCheck: forceCheck,
          currentDay: currentDayName,
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
        if (s.task_list_id) {
          processingRef.current.delete(s.task_list_id);
        }
      });
      
      if (error) {
        console.error('Error response from recurring tasks check:', error);
        throw error;
      }
      
      console.log('Recurring task lists check result:', data);
      
      // Invalidate tasks query to refresh the task list if new tasks were created
      const tasksCreated = data?.results?.some(result => result.status === 'created');
      if (tasksCreated) {
        console.log('Tasks were created, invalidating task queries');
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        
        toast.success('Created new recurring tasks from task lists');
      } else {
        console.log('No tasks were created by the recurring task lists check');
      }
    } catch (error) {
      console.error('Error checking recurring task lists:', error);
      toast.error('Error checking recurring task lists');
      // Clear processing flags in case of error
      if (settings) {
        settings.forEach(s => {
          if (s.task_list_id) {
            processingRef.current.delete(s.task_list_id);
          }
        });
      }
    }
  }, [checkGenerationLog, queryClient]);

  useEffect(() => {
    // Run an initial check when settings/projects are first loaded, but only once per component instance
    if ((listSettings?.length > 0 || projects?.length > 0) && !isLocalChecking && !isGlobalCheckInProgress && !mountedRef.current) {
      console.log('Initial unified recurring tasks check starting');
      mountedRef.current = true;
      checkRecurringTasks(false); // Don't force check on initial load, rely on checks
    }
  }, [listSettings, projects, checkRecurringTasks, isLocalChecking]);

  useEffect(() => {
    // Set up an interval to check once per hour during daytime hours (7am-10pm)
    const interval = setInterval(() => {
      try {
        const currentHour = new Date().getHours();
        // Only check during daytime hours (7am-10pm) and if no check is already in progress
        if (currentHour >= 7 && currentHour < 22 && !isLocalChecking && !isGlobalCheckInProgress) {
          console.log('Running scheduled unified recurring tasks check');
          checkRecurringTasks();
        }
      } catch (error) {
        console.error('Error in interval check:', error);
      }
    }, 30 * 60 * 1000); // Check every 30 minutes

    return () => clearInterval(interval);
  }, [checkRecurringTasks, isLocalChecking]);

  return {
    checkRecurringTasks,
    isChecking: isLocalChecking,
    forceCheck: () => checkRecurringTasks(true)
  };
};
