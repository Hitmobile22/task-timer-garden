
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentDayName } from '@/lib/utils';
import { toast } from 'sonner';

// Define proper types for the recurring settings
interface RecurringProjectSettings {
  id: number;
  project_id: number;
  days_of_week: string[];
  created_at: string;
  updated_at: string;
}

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

// Helper function to normalize day names for consistent comparison
const normalizeDay = (day: string): string => 
  day?.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase()) || '';

export const useRecurringProjectsCheck = () => {
  const [isLocalChecking, setIsLocalChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const processingRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef<boolean>(false);
  
  // Query for daily goals to determine if we need to reset them
  const { data: dailyGoals } = useQuery({
    queryKey: ['daily-project-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_goals')
        .select('*')
        .eq('goal_type', 'daily')
        .eq('is_enabled', true);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60 * 60 * 1000, // Refetch hourly
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000, // Stale after 30 minutes
  });

  // Query for active recurring projects with their settings
  const { data: projects } = useQuery({
    queryKey: ['recurring-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Projects')
        .select(`
          *,
          recurring_settings:recurring_project_settings(*)
        `)
        .eq('isRecurring', true)
        .neq('progress', 'Completed');
      
      if (error) throw error;
      
      console.log(`Found ${data?.length || 0} active recurring projects`);
      if (data && data.length > 0) {
        data.forEach(project => {
          console.log(`Recurring Project: ${project.id} (${project['Project Name']}) due: ${project.date_due}`);
          
          // Log project recurring settings if available
          if (project.recurring_settings && project.recurring_settings.length > 0) {
            const settings = project.recurring_settings[0] as RecurringProjectSettings;
            console.log(`Project ${project.id} recurring settings:`, settings);
            console.log(`Project ${project.id} days of week:`, settings.days_of_week || []);
          } else {
            console.log(`Project ${project.id} has no recurring settings configured`);
          }
        });
      }
      
      return data || [];
    },
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    refetchOnWindowFocus: false,
    staleTime: 15 * 60 * 1000, // Data is fresh for 15 minutes
  });

  // Check if a generation log exists for today
  const checkGenerationLog = useCallback(async (projectId: number) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { data, error } = await supabase
        .from('recurring_task_generation_logs')
        .select('*')
        .eq('project_id', projectId)
        .gte('generation_date', today.toISOString())
        .lt('generation_date', tomorrow.toISOString())
        .maybeSingle();
        
      if (error) {
        console.error(`Error checking generation log for project ${projectId}:`, error);
        return null;
      }
      
      if (data) {
        console.log(`Found generation log for project ${projectId}: ${data.tasks_generated} tasks on ${data.generation_date}`);
      } else {
        console.log(`No generation log found for project ${projectId} today`);
      }
      
      return data;
    } catch (error) {
      console.error('Error in checkGenerationLog:', error);
      return null;
    }
  }, []);

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

  // Check recurring projects
  const checkRecurringProjects = useCallback(async (forceCheck = false) => {
    // Prevent concurrent checks globally across instances
    if (isGlobalCheckInProgress || lastFullCheck.inProgress) {
      console.log('Global project check already in progress, skipping');
      return;
    }
    
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
      
      // Set global check flags
      isGlobalCheckInProgress = true;
      lastFullCheck.inProgress = true;
      lastFullCheck.timestamp = now;
      setIsLocalChecking(true);
      
      // Early morning check (before 7am don't generate tasks)
      const currentHour = new Date().getHours();
      if (currentHour < 7 && !forceCheck) {
        console.log('Before 7am, skipping project task generation check');
        return;
      }
      
      // Get current day for debugging
      const currentDayOfWeek = getCurrentDayName();
      const normalizedCurrentDay = normalizeDay(currentDayOfWeek);
      console.log(`Running recurring projects check on ${currentDayOfWeek} (normalized: ${normalizedCurrentDay})`);
      
      if (!projects || projects.length === 0) {
        console.log('No recurring projects found, skipping check');
        return;
      }
      
      // Filter projects and check for generation logs
      const filteredProjects = [];
      
      for (const project of projects) {
        // Skip if already processing this project
        if (processingRef.current.has(project.id)) {
          console.log(`Already processing project ${project.id}, skipping`);
          continue;
        }
        
        // Skip if rate-limited
        const lastCheck = lastGlobalCheck.get(project.id);
        if (!forceCheck && lastCheck && (now.getTime() - lastCheck.getTime()) < rateLimitMs) {
          console.log(`Rate limiting check for project ${project.id}, last checked ${Math.round((now.getTime() - lastCheck.getTime()) / 1000 / 60)} minutes ago`);
          continue;
        }
        
        // Check if this project should run today based on recurring settings
        if (project.recurring_settings && project.recurring_settings.length > 0) {
          // Extract and normalize the days of week from the project settings
          const settings = project.recurring_settings[0] as RecurringProjectSettings;
          const projectDays = settings.days_of_week?.map(normalizeDay) || [];
          const shouldRunToday = projectDays.includes(normalizedCurrentDay);
          
          console.log(`Project ${project.id} (${project['Project Name']}) days of week:`, 
            settings.days_of_week?.join(', ') || 'all days',
            `- Should run today (${currentDayOfWeek}): ${shouldRunToday}`);
          
          if (!shouldRunToday && !forceCheck) {
            console.log(`Project ${project.id} not scheduled for today (${currentDayOfWeek}), skipping`);
            continue;
          }
        }
        
        // Verify project due date is in the future or today
        const dueDate = project.date_due ? new Date(project.date_due) : null;
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
        const generationLog = await checkGenerationLog(project.id);
        
        if (generationLog && !forceCheck) {
          console.log(`Already generated ${generationLog.tasks_generated} tasks for project ${project.id} today, skipping`);
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
      
      // Send projects to edge function
      const { data, error } = await supabase.functions.invoke('check-recurring-projects', {
        body: {
          forceCheck: forceCheck,
          projects: filteredProjects.map(p => ({
            id: p.id,
            "Project Name": p["Project Name"],
            task_list_id: p.task_list_id,
            isRecurring: p.isRecurring,
            recurringTaskCount: p.recurringTaskCount,
            date_started: p.date_started,
            date_due: p.date_due,
            progress: p.progress,
            // Include recurring settings if available
            recurring_settings: p.recurring_settings?.length > 0 
              ? { 
                  days_of_week: (p.recurring_settings[0] as RecurringProjectSettings).days_of_week || [] 
                }
              : null
          })),
          dayOfWeek: currentDayOfWeek
        }
      });
      
      // Clear processing flags
      filteredProjects.forEach(p => {
        processingRef.current.delete(p.id);
      });
      
      if (error) {
        console.error('Error checking recurring projects:', error);
        throw error;
      }
      
      console.log('Recurring projects check result:', data);
      
      // Refresh task queries if tasks were created
      const tasksCreated = data?.results?.some(result => result.status === 'created');
      if (tasksCreated) {
        console.log('Tasks were created, invalidating task queries');
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        
        toast.success('Created new recurring tasks');
        
        // Since projects created tasks, also check if any task lists need to adjust their generation
        setTimeout(() => {
          // Trigger task list check specifically for the task lists that had projects generate tasks
          const affectedTaskLists = new Set(
            filteredProjects
              .filter(p => p.task_list_id)
              .map(p => p.task_list_id)
          );
          
          if (affectedTaskLists.size > 0) {
            console.log(`Notifying task list check about tasks created by projects for lists:`, 
              Array.from(affectedTaskLists));
          }
        }, 5000);
      } else {
        console.log('No tasks were created by the recurring projects check');
      }
      
      // Update last checked time
      setLastChecked(now);
      
    } catch (error) {
      console.error('Error in checkRecurringProjects:', error);
      toast.error('Error checking recurring projects');
    } finally {
      // Reset flags
      setIsLocalChecking(false);
      isGlobalCheckInProgress = false;
      lastFullCheck.inProgress = false;
    }
  }, [projects, queryClient, checkGenerationLog, checkAndResetDailyGoals]);

  // Run initial check when component mounts
  useEffect(() => {
    if (projects?.length > 0 && !isLocalChecking && !isGlobalCheckInProgress && !mountedRef.current) {
      console.log('Initial recurring projects check starting');
      mountedRef.current = true;
      // Delay initial check to allow task list checks to go first
      setTimeout(() => {
        checkRecurringProjects(true); // Force check on initial load
      }, 5000);
    }
  }, [projects, checkRecurringProjects, isLocalChecking]);
  
  // Check for day change to reset daily goals
  useEffect(() => {
    if (dailyGoals && dailyGoals.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check if we need to reset daily goals (new day)
      if (lastDailyGoalResetDay.toDateString() !== today.toDateString()) {
        checkAndResetDailyGoals();
      }
    }
  }, [dailyGoals, checkAndResetDailyGoals]);

  // Set up interval check
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const currentHour = new Date().getHours();
        // Only check during daytime hours (7am-10pm) and if no check is already in progress
        if (currentHour >= 7 && currentHour < 22 && !isLocalChecking && !isGlobalCheckInProgress) {
          console.log('Running scheduled recurring projects check');
          checkRecurringProjects();
        }
      } catch (error) {
        console.error('Error in interval check:', error);
      }
    }, 30 * 60 * 1000); // Check every 30 minutes (reduced from 62 minutes)

    return () => clearInterval(interval);
  }, [checkRecurringProjects, isLocalChecking]);

  return {
    checkRecurringProjects,
    resetDailyGoals: checkAndResetDailyGoals,
    isChecking: isLocalChecking,
    lastChecked,
    forceCheck: () => checkRecurringProjects(true)
  };
};
