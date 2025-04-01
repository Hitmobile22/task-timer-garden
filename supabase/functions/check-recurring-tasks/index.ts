
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to update or create generation log entry
async function updateGenerationLog(
  supabaseClient: any, 
  taskListId: number, 
  settingId: number, 
  tasksGenerated: number
) {
  try {
    // First try to update existing record for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const { data: existingLog, error: selectError } = await supabaseClient
      .from('recurring_task_generation_logs')
      .select('id')
      .eq('task_list_id', taskListId)
      .eq('setting_id', settingId)
      .gte('generation_date', today.toISOString())
      .lt('generation_date', tomorrow.toISOString())
      .maybeSingle();
      
    if (selectError) {
      console.error('Error checking for existing generation log:', selectError);
      return;
    }
    
    if (existingLog) {
      // Update existing record
      const { error: updateError } = await supabaseClient
        .from('recurring_task_generation_logs')
        .update({ tasks_generated: tasksGenerated })
        .eq('id', existingLog.id);
        
      if (updateError) {
        console.error('Error updating generation log:', updateError);
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabaseClient
        .from('recurring_task_generation_logs')
        .insert({
          task_list_id: taskListId,
          setting_id: settingId,
          tasks_generated: tasksGenerated,
          generation_date: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('Error creating generation log:', insertError);
      }
    }
  } catch (error) {
    console.error('Error in updateGenerationLog:', error);
  }
}

// Semaphore to prevent concurrent processing of the same task list
const processingLists = new Set();

// Cache to prevent duplicate task generation
const generationCache = new Map();

interface RecurringTaskSetting {
  id: number;
  task_list_id: number;
  enabled: boolean;
  daily_task_count: number;
  days_of_week: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Parse request body
    const body = await req.json();
    console.log("Received request body:", JSON.stringify(body));
    
    // Get today's date (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get tomorrow's date
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Get current day of week - use the one passed from client if available
    // This ensures consistency between client and server day determination
    let dayOfWeek = body.currentDay;
    if (!dayOfWeek) {
      dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    }
    console.log(`Current day of week: ${dayOfWeek}`);

    // Handle different request scenarios
    let settings: RecurringTaskSetting[] = [];
    let specificListId: number | null = null;
    const forceCheck = !!body.forceCheck;
    
    if (body.specificListId) {
      specificListId = body.specificListId;
      console.log(`Processing specific list ID: ${specificListId}`);
      
      // If this list is already being processed, skip to prevent duplicates
      if (processingLists.has(specificListId)) {
        console.log(`List ${specificListId} is already being processed, skipping`);
        return new Response(JSON.stringify({ 
          success: true, 
          results: [{ 
            task_list_id: specificListId, 
            status: 'skipped', 
            reason: 'concurrent_processing' 
          }]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      // Mark this list as being processed
      processingLists.add(specificListId);
      
      try {
        // Get only the most recent enabled setting for the specific task list
        // that includes today's day of week
        const { data: specificSettings, error: specificError } = await supabaseClient
          .from('recurring_task_settings')
          .select('*')
          .eq('enabled', true)
          .eq('task_list_id', specificListId)
          .contains('days_of_week', [dayOfWeek])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (specificError) {
          console.error('Error fetching specific task list settings:', specificError);
          throw specificError;
        }
        
        if (specificSettings && specificSettings.length > 0) {
          // Double-check the days of week match (defensive)
          if (specificSettings[0].days_of_week.includes(dayOfWeek) || forceCheck) {
            settings = specificSettings;
            console.log(`Confirmed setting for list ${specificListId} includes today (${dayOfWeek})`, 
              specificSettings[0].days_of_week);
          } else {
            console.log(`Setting for list ${specificListId} does not include today (${dayOfWeek})`, 
              specificSettings[0].days_of_week);
          }
        }
      } finally {
        // Ensure we remove the list from processing even if there's an error
        setTimeout(() => {
          processingLists.delete(specificListId);
        }, 5000);
      }
    } else if (body.settings && Array.isArray(body.settings)) {
      // If settings are provided in the request, use them
      settings = body.settings;
      
      // Log any day of week issues for debugging
      for (const setting of settings) {
        console.log(`Checking setting for list ${setting.task_list_id}:`);
        console.log(`  - days_of_week: ${JSON.stringify(setting.days_of_week)}`);
        console.log(`  - includes current day (${dayOfWeek}): ${setting.days_of_week.includes(dayOfWeek)}`);
      }
      
      // Filter out settings that don't match today's day of week unless forcing
      if (!forceCheck) {
        const originalCount = settings.length;
        settings = settings.filter(s => 
          s.days_of_week && 
          Array.isArray(s.days_of_week) && 
          s.days_of_week.includes(dayOfWeek)
        );
        console.log(`Filtered settings from ${originalCount} to ${settings.length} based on day of week (${dayOfWeek})`);
      }
      
      // Mark all lists as being processed
      for (const setting of settings) {
        if (setting.task_list_id && !processingLists.has(setting.task_list_id)) {
          processingLists.add(setting.task_list_id);
        }
      }
      
      // Ensure we remove the lists from processing
      setTimeout(() => {
        for (const setting of settings) {
          if (setting.task_list_id) {
            processingLists.delete(setting.task_list_id);
          }
        }
      }, 5000);
      
      console.log(`Using provided settings: ${settings.length} items`);
    } else {
      // Otherwise fetch all enabled settings for today's day of week
      console.log("Fetching all settings for today");
      const { data: allSettings, error: allSettingsError } = await supabaseClient
        .from('recurring_task_settings')
        .select('*')
        .eq('enabled', true)
        .contains('days_of_week', [dayOfWeek]);
      
      if (allSettingsError) {
        console.error('Error fetching all recurring task settings:', allSettingsError);
        throw allSettingsError;
      }
      
      if (allSettings) {
        // For each task list, only keep the most recent setting
        const latestSettingsByList = new Map<number, RecurringTaskSetting>();
        
        for (const setting of allSettings) {
          if (!setting.task_list_id) continue;
          
          // Double-check days of week - stricter validation
          if (!setting.days_of_week || !Array.isArray(setting.days_of_week) || !setting.days_of_week.includes(dayOfWeek)) {
            console.log(`Skipping setting for list ${setting.task_list_id} - not configured for ${dayOfWeek}`);
            continue;
          }
          
          const existingSetting = latestSettingsByList.get(setting.task_list_id);
          
          if (!existingSetting || 
              new Date(setting.created_at) > new Date(existingSetting.created_at)) {
            latestSettingsByList.set(setting.task_list_id, setting);
          }
        }
        
        settings = Array.from(latestSettingsByList.values());
        
        // Mark all lists as being processed
        for (const setting of settings) {
          if (setting.task_list_id && !processingLists.has(setting.task_list_id)) {
            processingLists.add(setting.task_list_id);
          }
        }
        
        // Ensure we remove the lists from processing
        setTimeout(() => {
          for (const setting of settings) {
            if (setting.task_list_id) {
              processingLists.delete(setting.task_list_id);
            }
          }
        }, 5000);
      }
    }
    
    console.log(`Processing ${settings.length} recurring task settings`);
    
    const results = [];

    for (const setting of settings) {
      try {
        if (!setting || !setting.task_list_id || !setting.enabled) {
          console.log('Skipping invalid setting', setting);
          results.push({ 
            task_list_id: setting?.task_list_id || null, 
            status: 'skipped', 
            reason: 'invalid_setting' 
          });
          continue;
        }
        
        // Final check to verify the setting is for today's day of week
        if (!forceCheck && (!setting.days_of_week || !Array.isArray(setting.days_of_week) || !setting.days_of_week.includes(dayOfWeek))) {
          console.log(`Skipping setting for list ${setting.task_list_id} - not configured for ${dayOfWeek}`);
          results.push({
            task_list_id: setting.task_list_id,
            status: 'skipped',
            reason: 'wrong_day',
            configured_days: setting.days_of_week,
            current_day: dayOfWeek
          });
          continue;
        }

        // Check if we already generated tasks for this list and setting today
        const { data: existingLogs, error: logsError } = await supabaseClient
          .from('recurring_task_generation_logs')
          .select('*')
          .eq('task_list_id', setting.task_list_id)
          .eq('setting_id', setting.id)
          .gte('generation_date', today.toISOString())
          .lt('generation_date', tomorrow.toISOString());
          
        if (logsError) {
          console.error(`Error checking generation logs for list ${setting.task_list_id}:`, logsError);
        } else if (existingLogs && existingLogs.length > 0 && !forceCheck) {
          // If we already generated tasks for this list today, skip
          console.log(`Already generated ${existingLogs[0].tasks_generated} tasks for list ${setting.task_list_id} today, skipping`);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'already_generated',
            existing: existingLogs[0].tasks_generated
          });
          continue;
        }

        // Create a unique cache key for this generation attempt
        const cacheKey = `${setting.task_list_id}-${today.toISOString().split('T')[0]}`;
        if (generationCache.has(cacheKey) && !forceCheck) {
          console.log(`Already processed list ${setting.task_list_id} today (from cache), skipping`);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'already_generated_cache'
          });
          continue;
        }

        // Get the task list info for the task name
        const { data: taskList, error: taskListError } = await supabaseClient
          .from('TaskLists')
          .select('name')
          .eq('id', setting.task_list_id)
          .single();

        if (taskListError) {
          console.error(`Error fetching task list ${setting.task_list_id}:`, taskListError);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'error', 
            error: 'task_list_fetch_failed' 
          });
          continue;
        }

        // Get all recurring projects associated with this task list
        const { data: taskListProjects, error: projectsError } = await supabaseClient
          .from('Projects')
          .select('id, "Project Name", isRecurring, recurringTaskCount, task_list_id')
          .eq('task_list_id', setting.task_list_id)
          .eq('isRecurring', true)
          .neq('progress', 'Completed');
          
        if (projectsError) {
          console.error(`Error fetching recurring projects for task list ${setting.task_list_id}:`, projectsError);
        }
        
        const recurringProjects = taskListProjects || [];
        console.log(`Found ${recurringProjects.length} recurring projects in task list ${setting.task_list_id}`);
        
        // Count ALL tasks (regardless of status) for this list created today, 
        // including tasks created for recurring projects belonging to this list
        const { data: todayTasks, error: todayTasksError } = await supabaseClient
          .from('Tasks')
          .select('id, "Task Name", Progress, date_started, date_due, project_id, task_list_id')
          .eq('task_list_id', setting.task_list_id)
          .gte('date_started', today.toISOString())
          .lt('date_started', tomorrow.toISOString());

        if (todayTasksError) {
          console.error(`Error counting today's tasks for list ${setting.task_list_id}:`, todayTasksError);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'error', 
            error: 'task_count_failed' 
          });
          continue;
        }

        // Count tasks by project to track how many we've already created for each recurring project
        const tasksByProject = new Map<number, number>();
        if (todayTasks && todayTasks.length > 0) {
          for (const task of todayTasks) {
            if (task.project_id) {
              const currentCount = tasksByProject.get(task.project_id) || 0;
              tasksByProject.set(task.project_id, currentCount + 1);
            }
          }
        }
        
        // Get today's generation logs for projects belonging to this task list to determine how many tasks were created
        // by recurring projects themselves
        const projectIds = recurringProjects.map(p => p.id);
        let projectGeneratedTaskCount = 0;
        
        if (projectIds.length > 0) {
          const { data: projectLogs, error: projectLogsError } = await supabaseClient
            .from('recurring_task_generation_logs')
            .select('project_id, tasks_generated')
            .in('project_id', projectIds)
            .gte('generation_date', today.toISOString())
            .lt('generation_date', tomorrow.toISOString());
            
          if (projectLogsError) {
            console.error(`Error fetching project generation logs:`, projectLogsError);
          } else if (projectLogs && projectLogs.length > 0) {
            // Sum up all tasks generated by projects
            projectGeneratedTaskCount = projectLogs.reduce((sum, log) => sum + (log.tasks_generated || 0), 0);
            console.log(`Found ${projectGeneratedTaskCount} tasks already generated by recurring projects in list ${setting.task_list_id}`);
          }
        }
        
        const todayTaskCount = todayTasks?.length || 0;
        const dailyTaskGoal = setting.daily_task_count || 1;
        
        console.log(`List ${setting.task_list_id} has ${todayTaskCount} tasks today (${projectGeneratedTaskCount} from projects), goal is ${dailyTaskGoal}`);
        
        // If we already have enough tasks (either created directly or by recurring projects), skip
        if ((todayTaskCount >= dailyTaskGoal) && !forceCheck) {
          console.log(`Already have enough tasks for list ${setting.task_list_id}, skipping`);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'enough_tasks', 
            existing: todayTaskCount,
            from_projects: projectGeneratedTaskCount
          });
          
          // Update or create generation log entry
          await updateGenerationLog(supabaseClient, setting.task_list_id, setting.id, todayTaskCount);
          
          // Add to cache
          generationCache.set(cacheKey, true);
          
          continue;
        }

        const listName = taskList?.name || `List ${setting.task_list_id}`;
        const tasksToCreate = [];
        
        // First, fulfill recurring project tasks to meet their individual goals
        let projectTasksNeeded = 0;
        let projectTasksCreated = 0;
        
        for (const project of recurringProjects) {
          if (!project.id || !project.recurringTaskCount) continue;
          
          const currentProjectTasks = tasksByProject.get(project.id) || 0;
          const projectTaskGoal = project.recurringTaskCount || 1;
          console.log(`Project ${project.id} (${project["Project Name"]}) has ${currentProjectTasks} tasks out of goal ${projectTaskGoal}`);
          
          // If the project already has enough tasks, skip it
          if (currentProjectTasks >= projectTaskGoal && !forceCheck) {
            console.log(`Project ${project.id} already has enough tasks (${currentProjectTasks}/${projectTaskGoal}), skipping`);
            continue;
          }
          
          const projectTasksToCreate = Math.max(0, projectTaskGoal - currentProjectTasks);
          projectTasksNeeded += projectTasksToCreate;
          
          console.log(`Creating ${projectTasksToCreate} new tasks for project ${project.id} (${project["Project Name"]})`);
          
          // Get existing task names for this project
          const existingProjectTaskNames = todayTasks
            ? todayTasks
                .filter(task => task.project_id === project.id)
                .map(task => task["Task Name"])
            : [];
            
          for (let i = 0; i < projectTasksToCreate; i++) {
            // Always start tasks exactly at 9am (consistent time)
            const taskStartTime = new Date(today);
            taskStartTime.setHours(9, 0 + (i * 30), 0, 0); // All start at 9:00 with 30-min increments
            
            const taskEndTime = new Date(taskStartTime);
            taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25 min duration
            
            let taskNumber = currentProjectTasks + i + 1;
            let taskName = `${project["Project Name"]} - Task ${taskNumber}`;
            
            // Ensure we don't create duplicate task names
            let uniqueNameCounter = 1;
            while (existingProjectTaskNames.includes(taskName)) {
              taskName = `${project["Project Name"]} - Task ${taskNumber} (${uniqueNameCounter})`;
              uniqueNameCounter++;
            }
            
            // Add the task name to our tracking array to prevent duplicates in this batch
            existingProjectTaskNames.push(taskName);
              
            tasksToCreate.push({
              "Task Name": taskName,
              Progress: "Not started",
              date_started: taskStartTime.toISOString(),
              date_due: taskEndTime.toISOString(),
              task_list_id: setting.task_list_id,
              project_id: project.id
            });
            
            projectTasksCreated++;
          }
        }
        
        // Calculate remaining number of tasks needed for this list (after fulfilling project requirements)
        // Only create additional tasks for the task list directly if the task list's goal is greater than
        // the sum of all recurring project goals
        const totalRecurringTaskGoals = recurringProjects.reduce((sum, p) => sum + (p.recurringTaskCount || 1), 0);
        const listDirectTasksNeeded = Math.max(0, dailyTaskGoal - totalRecurringTaskGoals);
        
        console.log(`List ${setting.task_list_id} has a daily task goal of ${dailyTaskGoal}, with recurring project goals totaling ${totalRecurringTaskGoals}`);
        console.log(`Need to create ${listDirectTasksNeeded} additional tasks directly for the list (not assigned to projects)`);
        
        // Calculate how many additional tasks we need to create after accounting for existing tasks
        const listDirectTasksAlreadyCreated = todayTaskCount - (todayTasks?.filter(t => t.project_id !== null).length || 0);
        const additionalListTasksToCreate = Math.max(0, listDirectTasksNeeded - listDirectTasksAlreadyCreated);
        
        console.log(`List ${setting.task_list_id} already has ${listDirectTasksAlreadyCreated} direct tasks, need ${additionalListTasksToCreate} more`);
        
        // Create remaining tasks directly for the task list (not assigned to any project)
        if (additionalListTasksToCreate > 0) {
          // Check for existing task names to avoid duplicates
          const existingTaskNames = todayTasks 
            ? todayTasks
                .filter(task => task.project_id === null) // Only non-project tasks
                .map(task => task["Task Name"])
            : [];
          
          for (let i = 0; i < additionalListTasksToCreate; i++) {
            // Always start tasks exactly at 9am (consistent time)
            const taskStartTime = new Date(today);
            taskStartTime.setHours(9, 0 + ((projectTasksCreated + i) * 30), 0, 0); // All start at 9:00 with 30-min increments
            
            const taskEndTime = new Date(taskStartTime);
            taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25 min duration
            
            let taskNumber = listDirectTasksAlreadyCreated + i + 1;
            let taskName = `${listName} - Task ${taskNumber}`;
            
            // Ensure we don't create duplicate task names
            let uniqueNameCounter = 1;
            while (existingTaskNames.includes(taskName)) {
              taskName = `${listName} - Task ${taskNumber} (${uniqueNameCounter})`;
              uniqueNameCounter++;
            }
            
            // Add the task name to our tracking array to prevent duplicates in this batch
            existingTaskNames.push(taskName);
              
            tasksToCreate.push({
              "Task Name": taskName,
              Progress: "Not started",
              date_started: taskStartTime.toISOString(),
              date_due: taskEndTime.toISOString(),
              task_list_id: setting.task_list_id,
              project_id: null // Not associated with any project
            });
          }
        }

        if (tasksToCreate.length > 0) {
          const { data: newTasks, error: createError } = await supabaseClient
            .from('Tasks')
            .insert(tasksToCreate)
            .select();

          if (createError) {
            console.error(`Error creating tasks for list ${setting.task_list_id}:`, createError);
            results.push({ 
              task_list_id: setting.task_list_id, 
              status: 'error', 
              error: 'task_creation_failed' 
            });
            continue;
          }

          console.log(`Successfully created ${newTasks?.length || 0} tasks for list ${setting.task_list_id} (${projectTasksCreated} for projects, ${additionalListTasksToCreate} for the list itself)`);
          
          // Record the successful generation
          const totalTasksGenerated = (existingLogs?.[0]?.tasks_generated || 0) + (newTasks?.length || 0);
          await updateGenerationLog(
            supabaseClient, 
            setting.task_list_id, 
            setting.id, 
            totalTasksGenerated
          );
          
          // Add to cache to prevent duplicate processing
          generationCache.set(cacheKey, true);
          
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'created', 
            tasks_created: newTasks?.length || 0,
            for_projects: projectTasksCreated,
            for_list: additionalListTasksToCreate 
          });
        } else {
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'no_tasks_needed' 
          });
        }
      } catch (settingError) {
        console.error(`Error processing setting for list ${setting?.task_list_id}:`, settingError);
        results.push({
          task_list_id: setting?.task_list_id,
          status: 'error',
          error: settingError.message
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Error checking recurring tasks:', error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
