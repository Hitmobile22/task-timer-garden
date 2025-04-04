
import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { useProjectsQuery, useDailyGoalsQuery } from './useProjectsQuery';
import { useGenerationLogCheck } from './useGenerationLogCheck';
import { useDailyGoalsReset } from './useDailyGoalsReset';
import { 
  isGlobalCheckInProgress, 
  lastGlobalCheck, 
  lastFullCheck,
  normalizeDay,
  getCurrentNormalizedDay,
  isTooEarlyForTaskGeneration,
  shouldRateLimitCheck
} from '@/utils/recurringUtils';
import { RecurringProject, RecurringProjectSettings, ProjectForEdgeFunction } from '@/types/recurring.types';
import { getCurrentDayName } from '@/lib/utils';

export const useRecurringProjectsCheck = () => {
  const [isLocalChecking, setIsLocalChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  const processingRef = useRef<Set<number>>(new Set());
  const mountedRef = useRef<boolean>(false);
  
  const { data: projects } = useProjectsQuery();
  const { data: dailyGoals } = useDailyGoalsQuery();
  const checkGenerationLog = useGenerationLogCheck();
  const checkAndResetDailyGoals = useDailyGoalsReset();

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
      if (isTooEarlyForTaskGeneration() && !forceCheck) {
        console.log('Before 7am, skipping project task generation check');
        return;
      }
      
      // Get current day for debugging
      const currentDayOfWeek = getCurrentDayName();
      const normalizedCurrentDay = getCurrentNormalizedDay();
      console.log(`Running recurring projects check on ${currentDayOfWeek} (normalized: ${normalizedCurrentDay})`);
      
      if (!projects || projects.length === 0) {
        console.log('No recurring projects found, skipping check');
        return;
      }
      
      // Filter projects and check for generation logs
      const filteredProjects: RecurringProject[] = [];
      
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
      
      // Prepare projects for the edge function
      const projectsForEdgeFunction: ProjectForEdgeFunction[] = filteredProjects.map(p => ({
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
      }));
      
      // Send projects to edge function
      const { data, error } = await supabase.functions.invoke('check-recurring-projects', {
        body: {
          forceCheck: forceCheck,
          projects: projectsForEdgeFunction,
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
      checkAndResetDailyGoals();
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
