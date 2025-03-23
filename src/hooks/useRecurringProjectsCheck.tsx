
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

      // Check if we've already generated tasks for this project today (using generation logs)
      const { data: generationLogs, error: logsError } = await supabase
        .from('recurring_task_generation_logs')
        .select('*')
        .eq('project_id', project.id)
        .gte('generation_date', today.toISOString())
        .lt('generation_date', tomorrow.toISOString())
        .maybeSingle();

      if (logsError) throw logsError;
      
      // If we already have a generation log for today, skip task creation
      if (generationLogs) {
        console.log(`Already generated tasks for project ${project.id} (${project["Project Name"]}) today according to logs`);
        return;
      }

      // Get ALL tasks EVER created for this project for today (including archived/deleted ones)
      const { data: allTodayTasks, error: allTasksError } = await supabase
        .from('Tasks')
        .select('id, "Task Name", Progress')
        .eq('project_id', project.id)
        .gte('date_started', today.toISOString())
        .lt('date_started', tomorrow.toISOString());

      if (allTasksError) throw allTasksError;

      const allTodayTaskCount = allTodayTasks?.length || 0;
      
      if (allTodayTaskCount > 0) {
        console.log(`Found ${allTodayTaskCount} tasks created today for project ${project.id} (${project["Project Name"]})`);
        
        // Create a generation log to mark that we've created tasks for this project today
        await supabase
          .from('recurring_task_generation_logs')
          .insert({
            project_id: project.id,
            tasks_generated: allTodayTaskCount,
            generation_date: new Date().toISOString()
          });
          
        return;
      }

      // Calculate how many tasks to add
      const taskCount = project.recurringTaskCount || 1;
      const neededTasks = Math.max(0, taskCount - allTodayTaskCount);

      // If we need to create tasks
      if (neededTasks > 0) {
        console.log(`Creating ${neededTasks} recurring tasks for project: ${project["Project Name"]}`);
        
        // Create tasks starting at 9am with 30 min intervals
        const newTasks = [];
        const existingTaskNames = allTodayTasks?.map(task => task["Task Name"]) || [];
        
        for (let i = 0; i < neededTasks; i++) {
          // All tasks start at 9:00 AM, with 30 minute intervals if there are multiple
          const taskStartTime = new Date(today);
          taskStartTime.setHours(9, 0, 0, 0);
          
          if (i > 0) {
            taskStartTime.setMinutes(i * 30);
          }
          
          const taskEndTime = new Date(taskStartTime);
          taskEndTime.setMinutes(taskStartTime.getMinutes() + 25);
          
          // Create a unique task name
          let taskName = `${project["Project Name"]} - Task ${allTodayTaskCount + i + 1}`;
          let uniqueNameCounter = 1;
          
          // Ensure we don't create duplicate task names
          while (existingTaskNames.includes(taskName)) {
            taskName = `${project["Project Name"]} - Task ${allTodayTaskCount + i + 1} (${uniqueNameCounter})`;
            uniqueNameCounter++;
          }
          
          // Add new task name to tracking array
          existingTaskNames.push(taskName);

          newTasks.push({
            "Task Name": taskName,
            Progress: "Not started" as const,
            project_id: project.id,
            task_list_id: project.task_list_id || 1,
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            order: allTodayTaskCount + i,
            archived: false,
          });
        }

        if (newTasks.length > 0) {
          const { error: insertError } = await supabase
            .from('Tasks')
            .insert(newTasks);

          if (insertError) throw insertError;
          
          console.log(`Successfully created ${newTasks.length} tasks for project ${project.id}`);
          
          // Log generation to prevent duplicate generation
          await supabase
            .from('recurring_task_generation_logs')
            .insert({
              project_id: project.id,
              tasks_generated: newTasks.length,
              generation_date: new Date().toISOString()
            });
        }
      } else {
        console.log(`No new tasks needed for project ${project.id} (${project["Project Name"]})`);
      }
    } catch (error) {
      console.error('Error ensuring project has tasks:', error);
    }
  };
};
