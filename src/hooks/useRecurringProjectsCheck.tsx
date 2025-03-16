
import { useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Define explicit type for project data to avoid deep type instantiation
type RecurringProject = {
  id: number;
  "Project Name": string;
  date_started?: string;
  date_due?: string;
  progress: string;
  isRecurring: boolean;
  recurringTaskCount?: number;
  task_list_id?: number;
};

export const useRecurringProjectsCheck = () => {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const queryClient = useQueryClient();
  
  const { data: projects } = useQuery({
    queryKey: ['recurring-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Projects')
        .select('*')
        .eq('isRecurring', true)
        .neq('progress', 'Completed');
      
      if (error) throw error;
      
      // Map the data to match our RecurringProject type
      return (data || []) as RecurringProject[];
    },
  });

  useEffect(() => {
    const checkRecurringProjects = async () => {
      // Early morning check (before 7am don't generate tasks)
      const currentHour = new Date().getHours();
      if (currentHour < 7) {
        console.log('Before 7am, skipping recurring project task generation');
        return;
      }
      
      if (projects && projects.length > 0) {
        try {
          // For each recurring project, check if tasks need to be created
          for (const project of projects) {
            await ensureProjectHasTasks(project);
          }
          
          // Update last checked time
          setLastChecked(new Date());
          
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
        } catch (error) {
          console.error('Error checking recurring projects:', error);
        }
      }
    };

    // Check on mount if there are any enabled recurring projects
    if (!lastChecked && projects && projects.length > 0) {
      checkRecurringProjects();
    }

    // Also set up an interval to check once per day
    const interval = setInterval(() => {
      const currentHour = new Date().getHours();
      // Only check during daytime hours (7am-10pm)
      if (currentHour >= 7 && currentHour < 22) {
        checkRecurringProjects();
      }
    }, 24 * 60 * 60 * 1000); // Check once per day

    return () => clearInterval(interval);
  }, [projects, lastChecked, queryClient]);

  const ensureProjectHasTasks = async (project: RecurringProject) => {
    try {
      // Get today's date boundaries
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get ALL tasks for today for this project (regardless of status)
      // This is the key change - we now count completed tasks too
      const { data: todayTasks, error: todayTasksError } = await supabase
        .from('Tasks')
        .select('id, "Task Name", Progress')
        .eq('project_id', project.id)
        .gte('date_started', today.toISOString())
        .lt('date_started', tomorrow.toISOString());

      if (todayTasksError) throw todayTasksError;

      const todayTaskCount = todayTasks?.length || 0;
      
      if (todayTaskCount > 0) {
        console.log(`Found ${todayTaskCount} tasks created today for project ${project.id} (${project["Project Name"]})`);
      }

      // Calculate how many tasks to add
      const taskCount = project.recurringTaskCount || 1;
      const neededTasks = Math.max(0, taskCount - todayTaskCount);

      // If we need to create tasks
      if (neededTasks > 0) {
        console.log(`Creating ${neededTasks} recurring tasks for project: ${project["Project Name"]}`);
        
        // Create tasks starting at 9am today with 30 min intervals
        const startingTime = new Date(today);
        startingTime.setHours(9, 0, 0, 0);

        const newTasks = [];
        for (let i = 0; i < neededTasks; i++) {
          const taskStartTime = new Date(startingTime);
          taskStartTime.setMinutes(startingTime.getMinutes() + (i * 30));
          
          const taskEndTime = new Date(taskStartTime);
          taskEndTime.setMinutes(taskStartTime.getMinutes() + 25);

          newTasks.push({
            "Task Name": `${project["Project Name"]} Task ${todayTaskCount + i + 1}`,
            Progress: "Not started" as const,
            project_id: project.id,
            task_list_id: project.task_list_id || 1,
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            order: todayTaskCount + i,
            archived: false,
          });
        }

        if (newTasks.length > 0) {
          const { error: insertError } = await supabase
            .from('Tasks')
            .insert(newTasks);

          if (insertError) throw insertError;
          
          console.log(`Successfully created ${newTasks.length} tasks for project ${project.id}`);
        }
      } else {
        console.log(`No new tasks needed for project ${project.id} (${project["Project Name"]})`);
      }
    } catch (error) {
      console.error('Error ensuring project has tasks:', error);
    }
  };
};
