import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { useProjectsQuery, useDailyGoalsQuery } from './useProjectsQuery';
import { useGenerationLogCheck } from './useGenerationLogCheck';
import { useDailyGoalsReset } from './useDailyGoalsReset';
import { 
  getIsGlobalCheckInProgress, 
  setIsGlobalCheckInProgress,
  getLastGlobalCheck, 
  getLastFullCheck,
  normalizeDay,
  getCurrentNormalizedDay,
  isTooEarlyForTaskGeneration,
  shouldRateLimitCheck,
  isDayMatch
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

  const checkRecurringProjects = useCallback(async (forceCheck = false) => {
    if (getIsGlobalCheckInProgress() || getLastFullCheck().inProgress) {
      console.log('Global project check already in progress, skipping');
      return;
    }
    
    const now = new Date();
    const timeSinceLastCheck = now.getTime() - getLastFullCheck().timestamp.getTime();
    const rateLimitMs = 15 * 60 * 1000; // 15 minutes
    
    if (!forceCheck && timeSinceLastCheck < rateLimitMs) {
      console.log(`Rate limiting global check - last checked ${Math.round(timeSinceLastCheck / 1000 / 60)} minutes ago`);
      return;
    }
    
    try {
      await checkAndResetDailyGoals();
      
      setIsGlobalCheckInProgress(true);
      getLastFullCheck().inProgress = true;
      getLastFullCheck().timestamp = now;
      setIsLocalChecking(true);
      
      if (isTooEarlyForTaskGeneration() && !forceCheck) {
        console.log('Before 7am, skipping project task generation check');
        return;
      }
      
      const currentDayOfWeek = getCurrentDayName();
      const normalizedCurrentDay = getCurrentNormalizedDay();
      console.log(`Running recurring projects check on ${currentDayOfWeek} (normalized: ${normalizedCurrentDay})`);
      
      if (!projects || projects.length === 0) {
        console.log('No recurring projects found, skipping check');
        return;
      }
      
      const filteredProjects: RecurringProject[] = [];
      const lastGlobalCheck = getLastGlobalCheck();
      
      for (const project of projects) {
        if (processingRef.current.has(project.id)) {
          console.log(`Already processing project ${project.id}, skipping`);
          continue;
        }
        
        const lastCheck = lastGlobalCheck.get(project.id);
        if (!forceCheck && lastCheck && (now.getTime() - lastCheck.getTime()) < rateLimitMs) {
          console.log(`Rate limiting check for project ${project.id}, last checked ${Math.round((now.getTime() - lastCheck.getTime()) / 1000 / 60)} minutes ago`);
          continue;
        }
        
        if (project.recurring_settings && project.recurring_settings.length > 0) {
          const settings = project.recurring_settings[0] as RecurringProjectSettings;
          const projectDays = settings.days_of_week?.map(normalizeDay) || [];
          
          const shouldRunToday = isDayMatch(normalizedCurrentDay, projectDays);
          
          console.log(`Project ${project.id} (${project['Project Name']}) days of week:`, 
            settings.days_of_week?.join(', ') || 'all days',
            `- Should run today (${currentDayOfWeek}): ${shouldRunToday}`);
          
          if (!shouldRunToday && !forceCheck) {
            console.log(`Project ${project.id} not scheduled for today (${currentDayOfWeek}), skipping`);
            continue;
          }
        }
        
        const dueDate = project.date_due ? new Date(project.date_due) : null;
        if (dueDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dueDate < today) {
            console.log(`Project ${project.id} (${project['Project Name']}) due date ${dueDate.toISOString()} is in the past, updating name if needed`);
            
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
      
      const projectsForEdgeFunction: ProjectForEdgeFunction[] = filteredProjects.map(p => ({
        id: p.id,
        "Project Name": p["Project Name"],
        task_list_id: p.task_list_id,
        isRecurring: p.isRecurring,
        recurringTaskCount: p.recurringTaskCount,
        date_started: p.date_started,
        date_due: p.date_due,
        progress: p.progress,
        recurring_settings: p.recurring_settings?.length > 0 
          ? { 
              days_of_week: (p.recurring_settings[0] as RecurringProjectSettings).days_of_week || [] 
            }
          : null
      }));
      
      const { data, error } = await supabase.functions.invoke('check-recurring-projects', {
        body: {
          forceCheck: forceCheck,
          projects: projectsForEdgeFunction,
          dayOfWeek: currentDayOfWeek
        }
      });
      
      filteredProjects.forEach(p => {
        processingRef.current.delete(p.id);
      });
      
      if (error) {
        console.error('Error checking recurring projects:', error);
        throw error;
      }
      
      console.log('Recurring projects check result:', data);
      
      const tasksCreated = data?.results?.some(result => result.status === 'created');
      if (tasksCreated) {
        console.log('Tasks were created, invalidating task queries');
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        
        toast.success('Created new recurring tasks');
        
        setTimeout(() => {
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
      
      setLastChecked(now);
    } catch (error) {
      console.error('Error in checkRecurringProjects:', error);
      toast.error('Error checking recurring projects');
    } finally {
      setIsLocalChecking(false);
      setIsGlobalCheckInProgress(false);
      getLastFullCheck().inProgress = false;
    }
  }, [projects, queryClient, checkGenerationLog, checkAndResetDailyGoals]);

  useEffect(() => {
    if (projects?.length > 0 && !isLocalChecking && !getIsGlobalCheckInProgress() && !mountedRef.current) {
      mountedRef.current = true;
      setTimeout(() => {
        checkRecurringProjects(false);
      }, 5000);
    }
  }, [projects, checkRecurringProjects, isLocalChecking]);
  
  useEffect(() => {
    if (dailyGoals && dailyGoals.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      checkAndResetDailyGoals();
    }
  }, [dailyGoals, checkAndResetDailyGoals]);

  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const currentHour = new Date().getHours();
        if (currentHour >= 7 && currentHour < 22 && !isLocalChecking && !getIsGlobalCheckInProgress()) {
          checkRecurringProjects();
        }
      } catch (error) {
        console.error('Error in interval check:', error);
      }
    }, 30 * 60 * 1000);
    
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
