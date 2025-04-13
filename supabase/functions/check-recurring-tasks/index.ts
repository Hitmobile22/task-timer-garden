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

// Helper function to normalize day names for consistent comparison
const normalizeDay = (day: string): string => 
  day?.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase()) || '';

interface RecurringTaskSetting {
  id: number;
  task_list_id: number;
  enabled: boolean;
  daily_task_count: number;
  days_of_week: string[];
  created_at?: string;
}

// Enhanced count function that includes completed tasks for today
const countAllTasksForDaily = async (supabaseClient: any, taskListId: number) => {
  try {
    // Get today's date bounds
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // 1. Count active tasks in the list (Not Started or In Progress)
    const { data: activeTasks, error: activeError } = await supabaseClient
      .from('Tasks')
      .select('id')
      .eq('task_list_id', taskListId)
      .in('Progress', ['Not started', 'In progress']);
      
    if (activeError) {
      console.error(`Error counting active tasks for list ${taskListId}:`, activeError);
      return { total: 0, active: 0, completedToday: 0 };
    }
    
    // 2. Count tasks completed today
    const { data: completedTodayTasks, error: completedError } = await supabaseClient
      .from('Tasks')
      .select('id')
      .eq('task_list_id', taskListId)
      .eq('Progress', 'Completed')
      .gte('date_completed', today.toISOString()) // Use date_completed, not date_started
      .lt('date_completed', tomorrow.toISOString());
    
    if (completedError) {
      console.error(`Error counting completed tasks for list ${taskListId}:`, completedError);
      return { total: 0, active: 0, completedToday: 0 };
    }
    
    // Calculate totals
    const activeCount = activeTasks?.length || 0;
    const completedTodayCount = completedTodayTasks?.length || 0;
    const totalCount = activeCount + completedTodayCount;
    
    console.log(`Task list ${taskListId} counts: active=${activeCount}, completedToday=${completedTodayCount}, total=${totalCount}`);
    
    return { 
      total: totalCount,
      active: activeCount,
      completedToday: completedTodayCount
    };
  } catch (error) {
    console.error('Error in countAllTasksForDaily:', error);
    return { total: 0, active: 0, completedToday: 0 };
  }
};

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
    
    // Normalize the day name for consistent case-insensitive comparison
    const normalizedCurrentDay = normalizeDay(dayOfWeek);
    console.log(`Current day of week: ${dayOfWeek} (normalized: ${normalizedCurrentDay})`);

    // Handle different request scenarios
    let settings: RecurringTaskSetting[] = [];
    let specificListId: number | null = null;
    const forceCheck = !!body.forceCheck;
    
    // When processing a specific list
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
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (specificError) {
          console.error('Error fetching specific task list settings:', specificError);
          throw specificError;
        }
        
        if (specificSettings && specificSettings.length > 0) {
          console.log(`Found settings for list ${specificListId}:`, specificSettings[0]);
          
          // Check and log days of week
          const settingDays = specificSettings[0].days_of_week || [];
          console.log(`List ${specificListId} configured days:`, settingDays);
          
          // Normalize all days in the setting for consistent comparison
          const normalizedSettingDays = settingDays.map(normalizeDay);
          console.log(`Normalized days for list ${specificListId}:`, normalizedSettingDays);
          
          // Check if today's day is in the normalized days array
          const dayMatches = normalizedSettingDays.includes(normalizedCurrentDay);
          console.log(`Day match check for list ${specificListId}: ${dayMatches} (${normalizedCurrentDay} in [${normalizedSettingDays.join(', ')}])`);
          
          // Double-check the days of week match (defensive) or force check
          if (dayMatches || forceCheck) {
            console.log(`Confirmed setting for list ${specificListId} includes today (${dayOfWeek}) or force check is enabled`);
            settings = specificSettings;
          } else {
            console.log(`Setting for list ${specificListId} does not include today (${dayOfWeek})`);
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
        
        // Normalize all days for this setting
        const normalizedSettingDays = (setting.days_of_week || []).map(normalizeDay);
        const settingIncludesToday = normalizedSettingDays.includes(normalizedCurrentDay);
        
        console.log(`  - normalized days: [${normalizedSettingDays.join(', ')}]`);
        console.log(`  - includes current day (${normalizedCurrentDay}): ${settingIncludesToday}`);
      }
      
      // Filter out settings that don't match today's day of week unless forcing
      if (!forceCheck) {
        const originalCount = settings.length;
        settings = settings.filter(s => {
          if (!s.days_of_week || !Array.isArray(s.days_of_week)) return false;
          
          // Use normalized comparison for consistency
          const normalizedSettingDays = s.days_of_week.map(normalizeDay);
          return normalizedSettingDays.includes(normalizedCurrentDay);
        });
        
        console.log(`Filtered settings from ${originalCount} to ${settings.length} based on day of week (${normalizedCurrentDay})`);
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
        .eq('enabled', true);
      
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
          if (!setting.days_of_week || !Array.isArray(setting.days_of_week)) {
            console.log(`Skipping setting for list ${setting.task_list_id} - missing days of week`);
            continue;
          }
          
          // Normalize days for consistent comparison
          const normalizedSettingDays = setting.days_of_week.map(normalizeDay);
          const settingIncludesToday = normalizedSettingDays.includes(normalizedCurrentDay);
          
          if (!settingIncludesToday && !forceCheck) {
            console.log(`Skipping setting for list ${setting.task_list_id} - not configured for ${dayOfWeek}`);
            continue;
          }
          
          const existingSetting = latestSettingsByList.get(setting.task_list_id);
          
          if (!existingSetting || 
              !existingSetting.created_at ||
              !setting.created_at ||
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
        if (!forceCheck && (!setting.days_of_week || !Array.isArray(setting.days_of_week))) {
          console.log(`Skipping setting for list ${setting.task_list_id} - missing day configuration`);
          results.push({
            task_list_id: setting.task_list_id,
            status: 'skipped',
            reason: 'missing_days_config'
          });
          continue;
        }
        
        if (!forceCheck) {
          // Normalize days of week for consistent comparison
          const normalizedSettingDays = setting.days_of_week.map(normalizeDay);
          const dayMatches = normalizedSettingDays.includes(normalizedCurrentDay);
          
          console.log(`Day match check for list ${setting.task_list_id}: ${dayMatches}`);
          console.log(`  - Setting days: [${setting.days_of_week.join(', ')}]`);
          console.log(`  - Normalized: [${normalizedSettingDays.join(', ')}]`);
          console.log(`  - Current day: ${dayOfWeek} (normalized: ${normalizedCurrentDay})`);
          
          if (!dayMatches) {
            console.log(`Skipping setting for list ${setting.task_list_id} - not configured for ${dayOfWeek}`);
            results.push({
              task_list_id: setting.task_list_id,
              status: 'skipped',
              reason: 'wrong_day',
              configured_days: setting.days_of_week,
              normalized_days: normalizedSettingDays,
              current_day: dayOfWeek,
              normalized_current_day: normalizedCurrentDay
            });
            continue;
          }
        }

        // Enhanced check for existing generation logs to prevent duplicates
        const { data: existingLogs, error: logsError } = await supabaseClient
          .from('recurring_task_generation_logs')
          .select('*')
          .eq('task_list_id', setting.task_list_id)
          .gte('generation_date', today.toISOString())
          .lt('generation_date', tomorrow.toISOString())
          .order('generation_date', { ascending: false });
          
        if (logsError) {
          console.error(`Error checking generation logs for list ${setting.task_list_id}:`, logsError);
        } else if (existingLogs && existingLogs.length > 0 && !forceCheck) {
          // If we already generated tasks for this list today, skip
          // Sum up tasks generated across all logs for this list today
          const totalTasksGenerated = existingLogs.reduce((sum, log) => sum + (log.tasks_generated || 0), 0);
          console.log(`Already generated ${totalTasksGenerated} tasks for list ${setting.task_list_id} today, skipping`);
          
          if (totalTasksGenerated >= setting.daily_task_count) {
            console.log(`Daily task goal of ${setting.daily_task_count} already met for list ${setting.task_list_id}, skipping`);
            results.push({ 
              task_list_id: setting.task_list_id, 
              status: 'skipped', 
              reason: 'already_generated',
              existing: totalTasksGenerated
            });
            continue;
          }
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
        
        // CRITICAL FIX: Count BOTH active and completed tasks for today
        const taskCounts = await countAllTasksForDaily(supabaseClient, setting.task_list_id);
        console.log(`List ${setting.task_list_id} has ${taskCounts.total} total relevant tasks (${taskCounts.active} active, ${taskCounts.completedToday} completed today)`);
        
        // If we already have enough tasks (active + completed today) for the day, skip
        if ((taskCounts.total >= setting.daily_task_count) && !forceCheck) {
          console.log(`Already have enough tasks for list ${setting.task_list_id}, skipping`);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'enough_tasks', 
            existing: taskCounts.total,
            active: taskCounts.active,
            completed_today: taskCounts.completedToday
          });
          
          // Update generation log to reflect that we already have enough tasks
          await updateGenerationLog(supabaseClient, setting.task_list_id, setting.id, taskCounts.total);
          
          // Add to cache
          generationCache.set(cacheKey, true);
          
          continue;
        }

        const listName = taskList?.name || `List ${setting.task_list_id}`;
        const tasksToCreate = [];
        
        // First, check existing active tasks for each recurring project to meet their individual goals
        let projectTasksNeeded = 0;
        let projectTasksCreated = 0;
        
        for (const project of recurringProjects) {
          if (!project.id || !project.recurringTaskCount) continue;
          
          // Count active tasks for this project
          const { data: activeProjectTasks, error: projectTasksError } = await supabaseClient
            .from('Tasks')
            .select('id, "Task Name"')
            .eq('project_id', project.id)
            .in('Progress', ['Not started', 'In progress']);
            
          if (projectTasksError) {
            console.error(`Error counting active tasks for project ${project.id}:`, projectTasksError);
            continue;
          }
          
          // Count tasks completed today for this project
          const { data: completedTodayProjectTasks, error: completedProjectError } = await supabaseClient
            .from('Tasks')
            .select('id')
            .eq('project_id', project.id)
            .eq('Progress', 'Completed')
            .gte('date_completed', today.toISOString())
            .lt('date_completed', tomorrow.toISOString());
            
          if (completedProjectError) {
            console.error(`Error counting completed tasks for project ${project.id}:`, completedProjectError);
            continue;
          }
          
          const activeProjectTaskCount = activeProjectTasks?.length || 0;
          const completedTodayProjectTaskCount = completedTodayProjectTasks?.length || 0;
          const totalProjectTaskCount = activeProjectTaskCount + completedTodayProjectTaskCount;
          
          const projectTaskGoal = project.recurringTaskCount || 1;
          console.log(`Project ${project.id} (${project["Project Name"]}) has ${activeProjectTaskCount} active tasks and ${completedTodayProjectTaskCount} completed today, out of goal ${projectTaskGoal}`);
          
          // If the project already has enough total tasks for today, skip it
          if (totalProjectTaskCount >= projectTaskGoal && !forceCheck) {
            console.log(`Project ${project.id} already has enough tasks for today (${totalProjectTaskCount}/${projectTaskGoal}), skipping`);
            continue;
          }
          
          const projectTasksToCreate = Math.max(0, projectTaskGoal - totalProjectTaskCount);
          projectTasksNeeded += projectTasksToCreate;
          
          console.log(`Creating ${projectTasksToCreate} new tasks for project ${project.id} (${project["Project Name"]})`);
          
          // Get existing task names for this project
          const existingProjectTaskNames = activeProjectTasks ? activeProjectTasks.map(t => t["Task Name"]) : [];
          
          for (let i = 0; i < projectTasksToCreate; i++) {
            // Always start tasks at 9am (consistent time)
            const taskStartTime = new Date(today);
            taskStartTime.setHours(9, 0 + (i * 30), 0, 0); // All start at 9:00 with 30-min increments
            
            const taskEndTime = new Date(taskStartTime);
            taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25 min duration
            
            let taskNumber = totalProjectTaskCount + i + 1;
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
        
        // Get tasks not associated with recurring projects
        const { data: nonProjectTasks, error: nonProjectError } = await supabaseClient
          .from('Tasks')
          .select('id, "Task Name"')
          .eq('task_list_id', setting.task_list_id)
          .is('project_id', null)
          .in('Progress', ['Not started', 'In progress']);
          
        if (nonProjectError) {
          console.error(`Error fetching non-project tasks for list ${setting.task_list_id}:`, nonProjectError);
        }
        
        // Count tasks completed today not associated with any project
        const { data: completedTodayNonProjectTasks, error: completedNonProjectError } = await supabaseClient
          .from('Tasks')
          .select('id')
          .eq('task_list_id', setting.task_list_id)
          .is('project_id', null)
          .eq('Progress', 'Completed')
          .gte('date_completed', today.toISOString())
          .lt('date_completed', tomorrow.toISOString());
          
        if (completedNonProjectError) {
          console.error(`Error counting completed non-project tasks for list ${setting.task_list_id}:`, completedNonProjectError);
        }
        
        // Calculate how many direct list tasks we need
        const nonProjectActiveCount = nonProjectTasks?.length || 0;
        const nonProjectCompletedCount = completedTodayNonProjectTasks?.length || 0;
        const totalNonProjectCount = nonProjectActiveCount + nonProjectCompletedCount;
        
        console.log(`List ${setting.task_list_id} has ${nonProjectActiveCount} active non-project tasks and ${nonProjectCompletedCount} completed today`);
        
        // Determine how many additional tasks we need for the list itself
        const additionalListTasksToCreate = Math.max(0, setting.daily_task_count - taskCounts.total - projectTasksCreated);
        
        console.log(`List ${setting.task_list_id} needs ${additionalListTasksToCreate} more direct tasks`);
        
        // Create remaining tasks directly for the task list (not assigned to any project)
        if (additionalListTasksToCreate > 0) {
          // Check for existing task names to avoid duplicates
          const existingTaskNames = nonProjectTasks 
            ? nonProjectTasks.map(task => task["Task Name"])
            : [];
          
          for (let i = 0; i < additionalListTasksToCreate; i++) {
            // Always start tasks exactly at 9am (consistent time)
            const taskStartTime = new Date(today);
            taskStartTime.setHours(9, 0 + ((projectTasksCreated + i) * 30), 0, 0); // All start at 9:00 with 30-min increments
            
            const taskEndTime = new Date(taskStartTime);
            taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25 min duration
            
            let taskNumber = totalNonProjectCount + i + 1;
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
            tasksCreated: newTasks?.length || 0,
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
