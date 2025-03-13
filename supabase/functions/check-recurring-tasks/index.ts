
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

    // Get current time and check if it's after 7am
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(7, 0, 0, 0);

    // If it's before 7am, don't generate tasks
    if (today < startOfDay) {
      console.log('Before 7am, skipping task generation');
      return new Response(JSON.stringify({ success: true, message: 'Before 7am, no tasks generated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    // Get current day of week
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Get all enabled recurring task settings for the current day
    const { data: settings, error: settingsError } = await supabaseClient
      .from('recurring_task_settings')
      .select('*')
      .eq('enabled', true)
      .contains('days_of_week', [dayOfWeek]);
    
    if (settingsError) throw settingsError;
    if (!settings || settings.length === 0) {
      console.log('No active recurring task settings for today');
      return new Response(JSON.stringify({ success: true, message: 'No active settings for today' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    console.log(`Found ${settings.length} active recurring task settings for ${dayOfWeek}`);
    
    // For each settings entry, get the task list and check if tasks need to be generated
    const generatedTasks = [];
    const processedTaskLists = new Set(); // Track which task lists we've already processed
    
    for (const setting of settings) {
      // Verify the setting is actually enabled
      if (!setting.enabled) {
        console.log(`Settings ID ${setting.id} is marked as not enabled, skipping`);
        continue;
      }

      // Skip if we've already processed this task list
      if (processedTaskLists.has(setting.task_list_id)) {
        console.log(`Task list ${setting.task_list_id} already processed, skipping duplicate settings`);
        continue;
      }
      
      // Add this task list to our processed set
      processedTaskLists.add(setting.task_list_id);
      
      // Get the associated task list
      const { data: taskListData, error: taskListError } = await supabaseClient
        .from('TaskLists')
        .select('*')
        .eq('id', setting.task_list_id)
        .single<TaskList>();
      
      if (taskListError) {
        console.error(`Error getting task list ${setting.task_list_id}:`, taskListError);
        continue;
      }
      
      // Check if tasks have already been generated today
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      
      // Get ALL existing tasks for today (created today OR with today's start date),
      // including completed and deleted ones to avoid respawning them
      const { data: allTasksForToday, error: allTasksError } = await supabaseClient
        .from('Tasks')
        .select('id, "Task Name", Progress')
        .eq('task_list_id', setting.task_list_id)
        .or(`created_at.gte.${startOfToday.toISOString()},date_started.gte.${startOfToday.toISOString()},date_started.lt.${new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000).toISOString()}`);

      if (allTasksError) {
        console.error(`Error checking all tasks for list ${taskListData.name}:`, allTasksError);
        continue;
      }

      const allTasksCount = allTasksForToday?.length || 0;
      console.log(`Found ${allTasksCount} total tasks for list ${taskListData.name} for today (including deleted/completed)`);

      // If we already have enough tasks for today (created, completed, or deleted), skip
      if (allTasksCount >= setting.daily_task_count) {
        console.log(`Already have ${allTasksCount} tasks for list ${taskListData.name} (${setting.task_list_id}), which meets or exceeds the required ${setting.daily_task_count}`);
        continue;
      }

      // Only generate the difference between what we should have and what we already have
      const tasksToGenerate = setting.daily_task_count - allTasksCount;
      console.log(`Generating ${tasksToGenerate} more tasks for list ${taskListData.name} (${setting.task_list_id})`);
      
      const taskDate = new Date();
      const baseTaskName = `${taskListData.name} - Task`;
      
      // Get the highest task number to prevent duplicate numbering
      let highestTaskNumber = 0;
      if (allTasksForToday && allTasksForToday.length > 0) {
        for (const task of allTasksForToday) {
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
      
      for (let i = 0; i < tasksToGenerate; i++) {
        const taskNumber = highestTaskNumber + i + 1;
        const taskStartTime = new Date(taskDate);
        taskStartTime.setHours(9 + i * 2, 0, 0, 0); // Start at 9am, 2-hour increments
        
        const taskEndTime = new Date(taskStartTime);
        taskEndTime.setMinutes(taskEndTime.getMinutes() + 25); // 25-minute task
        
        const { data: taskData, error: taskError } = await supabaseClient
          .from('Tasks')
          .insert({
            "Task Name": `${baseTaskName} ${taskNumber}`,
            Progress: "Not started",
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            task_list_id: setting.task_list_id,
            order: allTasksCount + i,
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
      const { error: updateError } = await supabaseClient
        .from('TaskLists')
        .update({ last_tasks_added_at: new Date().toISOString() })
        .eq('id', setting.task_list_id);
      
      if (updateError) {
        console.error(`Error updating last_tasks_added_at for list ${taskListData.name}:`, updateError);
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
