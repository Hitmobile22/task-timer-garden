
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecurringTaskSettings {
  id: number;
  task_list_id: number;
  enabled: boolean;
  daily_task_count: number;
  days_of_week: string[];
}

interface TaskList {
  id: number;
  name: string;
  last_tasks_added_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Extract request body if any
    let requestBody = {};
    try {
      requestBody = await req.json();
    } catch (e) {
      // No request body or invalid JSON
      requestBody = {};
    }
    
    console.log('Request body:', JSON.stringify(requestBody));
    
    // Get current time and check if it's after 7am
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(7, 0, 0, 0);

    // If it's before 7am and not a force check, don't generate tasks
    if (today < startOfDay && !requestBody.forceCheck) {
      console.log('Before 7am, skipping task generation');
      return new Response(JSON.stringify({ success: true, message: 'Before 7am, no tasks generated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    // Get current day of week
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    console.log(`Current day of week: ${dayOfWeek}`);
    
    // Handle specific list ID check if provided
    if (requestBody.specificListId) {
      console.log(`Checking specific task list ID: ${requestBody.specificListId}`);
      const { data: settings, error: settingsError } = await supabaseClient
        .from('recurring_task_settings')
        .select('*')
        .eq('enabled', true)
        .eq('task_list_id', requestBody.specificListId)
        .contains('days_of_week', [dayOfWeek])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (settingsError) {
        console.error(`Error getting settings for list ${requestBody.specificListId}:`, settingsError);
        throw settingsError;
      }
      
      if (!settings || settings.length === 0 || !settings[0].enabled) {
        console.log(`No active settings for task list ${requestBody.specificListId} on ${dayOfWeek}`);
        return new Response(JSON.stringify({ 
          success: true, 
          message: `No active settings for task list ${requestBody.specificListId} on ${dayOfWeek}`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      const setting = settings[0];
      const result = await processTaskList(supabaseClient, setting, today, dayOfWeek);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Processed task list ${setting.task_list_id}`,
          result
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    // Get unique task lists with recurring settings that include the current day of week
    const { data: uniqueTaskLists, error: uniqueListsError } = await supabaseClient
      .from('recurring_task_settings')
      .select('task_list_id')
      .eq('enabled', true)
      .not('task_list_id', 'is', null) // Avoid null task_list_id values
      .contains('days_of_week', [dayOfWeek]);
    
    if (uniqueListsError) {
      console.error('Error fetching unique task lists:', uniqueListsError);
      throw uniqueListsError;
    }
    
    if (!uniqueTaskLists || uniqueTaskLists.length === 0) {
      console.log('No active recurring task settings for today');
      return new Response(JSON.stringify({ success: true, message: 'No active settings for today' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    // Get unique task list IDs
    const uniqueTaskListIds = [...new Set(uniqueTaskLists.map(item => item.task_list_id))].filter(id => id !== null);
    console.log(`Found ${uniqueTaskListIds.length} unique task lists with active settings for ${dayOfWeek}`);
    
    // For each unique task list, get the most recent active setting
    const generatedTasks = [];
    const processedTaskLists = new Set();
    
    for (const taskListId of uniqueTaskListIds) {
      // Skip if we've already processed this task list (prevent duplicates)
      if (processedTaskLists.has(taskListId)) {
        console.log(`Task list ${taskListId} already processed, skipping duplicate settings`);
        continue;
      }
      
      processedTaskLists.add(taskListId);
      
      // Get the most recent active setting for this task list
      const { data: settings, error: settingsError } = await supabaseClient
        .from('recurring_task_settings')
        .select('*')
        .eq('enabled', true)
        .eq('task_list_id', taskListId)
        .contains('days_of_week', [dayOfWeek])
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (settingsError) {
        console.error(`Error getting settings for list ${taskListId}:`, settingsError);
        continue;
      }
      
      if (!settings || settings.length === 0) {
        console.log(`No active settings for task list ${taskListId}`);
        continue;
      }
      
      const setting = settings[0];
      console.log(`Processing task list ${setting.task_list_id} with setting ID ${setting.id}`);
      
      // Skip if this setting is not enabled - double check to be sure
      if (!setting.enabled) {
        console.log(`Task list ${setting.task_list_id} is not enabled, skipping`);
        continue;
      }
      
      const result = await processTaskList(supabaseClient, setting, today, dayOfWeek);
      if (result.tasksGenerated && result.tasksGenerated.length > 0) {
        generatedTasks.push(...result.tasksGenerated);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Generated ${generatedTasks.length} tasks`,
        tasks: generatedTasks
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
    
  } catch (error) {
    console.error('Error in check-recurring-tasks:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Helper function to process an individual task list
async function processTaskList(supabase, setting, today, dayOfWeek) {
  try {
    // Confirm this setting includes the current day of week
    if (!setting.days_of_week.includes(dayOfWeek)) {
      console.log(`Task list ${setting.task_list_id} does not have ${dayOfWeek} enabled, skipping`);
      return { tasksGenerated: [] };
    }
    
    // Get the associated task list
    const { data: taskListData, error: taskListError } = await supabase
      .from('TaskLists')
      .select('*')
      .eq('id', setting.task_list_id)
      .single();
    
    if (taskListError) {
      console.error(`Error getting task list ${setting.task_list_id}:`, taskListError);
      return { tasksGenerated: [] };
    }
    
    // Define the midnight start of today for date filtering
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    
    // Get ALL tasks for this list created today (regardless of status)
    const { data: todayTasks, error: todayTasksError } = await supabase
      .from('Tasks')
      .select('id, "Task Name", Progress')
      .eq('task_list_id', setting.task_list_id)
      .gte('date_started', startOfToday.toISOString())
      .lt('date_started', new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000).toISOString());

    if (todayTasksError) {
      console.error(`Error checking today's tasks for list ${taskListData.name}:`, todayTasksError);
      return { tasksGenerated: [] };
    }

    const todayTaskCount = todayTasks?.length || 0;
    console.log(`Found ${todayTaskCount} tasks created today for list ${taskListData.name}`);

    // If we already have enough or more tasks than the daily task count (regardless of status), skip creating new ones
    if (todayTaskCount >= setting.daily_task_count) {
      console.log(`Already have ${todayTaskCount} tasks for list ${taskListData.name} (${setting.task_list_id}) today, which meets the daily goal of ${setting.daily_task_count}`);
      return { tasksGenerated: [] };
    }

    // Generate only the needed number of tasks
    const tasksToGenerate = setting.daily_task_count - todayTaskCount;
    console.log(`Generating ${tasksToGenerate} tasks for list ${taskListData.name} (${setting.task_list_id})`);
    
    // Always start tasks at 9am with 30-minute increments
    const baseTaskName = `${taskListData.name} - Task`;
    
    // Get the highest task number to prevent duplicate numbering
    let highestTaskNumber = 0;
    if (todayTasks && todayTasks.length > 0) {
      for (const task of todayTasks) {
        const taskName = task["Task Name"] || "";
        const match = taskName.match(/Task\s+(\d+)$/);
        if (match && match[1]) {
          const taskNumber = parseInt(match[1]);
          if (taskNumber > highestTaskNumber) {
            highestTaskNumber = taskNumber;
          }
        }
      }
    }
    
    const generatedTasks = [];
    
    for (let i = 0; i < tasksToGenerate; i++) {
      const taskNumber = highestTaskNumber + i + 1;
      
      // Always start at 9am with 30-minute increments
      const taskStartTime = new Date(today);
      taskStartTime.setHours(9, i * 30, 0, 0); // 9:00, 9:30, 10:00, etc.
      
      const taskEndTime = new Date(taskStartTime);
      taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25-minute task
      
      const { data: taskData, error: taskError } = await supabase
        .from('Tasks')
        .insert({
          "Task Name": `${baseTaskName} ${taskNumber}`,
          Progress: "Not started",
          date_started: taskStartTime.toISOString(),
          date_due: taskEndTime.toISOString(),
          task_list_id: setting.task_list_id,
          order: todayTaskCount + i,
        })
        .select()
        .single();
      
      if (taskError) {
        console.error(`Error creating task for list ${taskListData.name}:`, taskError);
        continue;
      }
      
      generatedTasks.push(taskData);
    }
    
    // Update the last_tasks_added_at timestamp
    if (tasksToGenerate > 0) {
      const { error: updateError } = await supabase
        .from('TaskLists')
        .update({ last_tasks_added_at: new Date().toISOString() })
        .eq('id', setting.task_list_id);
      
      if (updateError) {
        console.error(`Error updating last_tasks_added_at for list ${taskListData.name}:`, updateError);
      }
    }
    
    return { tasksGenerated: generatedTasks };
  } catch (error) {
    console.error(`Error processing task list:`, error);
    return { tasksGenerated: [] };
  }
}
