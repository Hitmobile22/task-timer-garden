
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Semaphore to prevent concurrent processing of the same task list
const processingLists = new Set();

interface RecurringTaskSetting {
  id: number;
  task_list_id: number;
  enabled: boolean;
  daily_task_count: number;
  days_of_week: string[];
}

interface TaskInfo {
  id: number;
  "Task Name": string;
  Progress: string;
  date_started: string;
  date_due: string;
  project_id: number | null;
}

interface GerationLogEntry {
  id: number;
  task_list_id: number;
  setting_id: number;
  generation_date: string;
  tasks_generated: number;
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
    
    // Get current day of week
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
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
          settings = specificSettings;
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

        // Count ALL tasks (regardless of status) for this list created today
        const { data: todayTasks, error: todayTasksError } = await supabaseClient
          .from('Tasks')
          .select('id, "Task Name", Progress, date_started, date_due, project_id')
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

        const todayTaskCount = todayTasks?.length || 0;
        const dailyTaskGoal = setting.daily_task_count || 1;
        
        console.log(`List ${setting.task_list_id} has ${todayTaskCount} tasks today, goal is ${dailyTaskGoal}`);
        
        if (todayTaskCount >= dailyTaskGoal && !forceCheck) {
          console.log(`Already have enough tasks for list ${setting.task_list_id}, skipping`);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'enough_tasks', 
            existing: todayTaskCount 
          });
          
          // Update or create generation log entry
          await updateGenerationLog(supabaseClient, setting.task_list_id, setting.id, todayTaskCount);
          
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

        const listName = taskList?.name || `List ${setting.task_list_id}`;
        const tasksToCreate = [];
        const neededTasks = forceCheck 
          ? (dailyTaskGoal - (existingLogs?.[0]?.tasks_generated || 0)) 
          : Math.max(0, dailyTaskGoal - todayTaskCount);
        
        if (neededTasks <= 0) {
          console.log(`No new tasks needed for list ${setting.task_list_id} (${listName})`);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'no_tasks_needed' 
          });
          continue;
        }
        
        console.log(`Creating ${neededTasks} new tasks for list ${setting.task_list_id} (${listName})`);
        
        // Get projects associated with this list to assign the tasks
        const { data: projects, error: projectsError } = await supabaseClient
          .from('Projects')
          .select('id, "Project Name"')
          .eq('task_list_id', setting.task_list_id)
          .neq('progress', 'Completed');
          
        const project = projects && projects.length > 0 ? projects[0] : null;
        
        for (let i = 0; i < neededTasks; i++) {
          // Always start tasks at 9am with 30-minute increments 
          const taskStartTime = new Date(today);
          taskStartTime.setHours(9, i * 30, 0, 0); // 9:00, 9:30, 10:00, etc.
          
          const taskEndTime = new Date(taskStartTime);
          taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25 min duration
          
          const taskName = project 
            ? `${project['Project Name']} - Task ${todayTaskCount + i + 1}`
            : `${listName} - Task ${todayTaskCount + i + 1}`;
            
          tasksToCreate.push({
            "Task Name": taskName,
            Progress: "Not started",
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            task_list_id: setting.task_list_id,
            project_id: project?.id || null
          });
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

          console.log(`Successfully created ${newTasks?.length || 0} tasks for list ${setting.task_list_id}`);
          
          // Record the successful generation
          const totalTasksGenerated = (existingLogs?.[0]?.tasks_generated || 0) + (newTasks?.length || 0);
          await updateGenerationLog(
            supabaseClient, 
            setting.task_list_id, 
            setting.id, 
            totalTasksGenerated
          );
          
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'created', 
            tasks_created: newTasks?.length || 0 
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
