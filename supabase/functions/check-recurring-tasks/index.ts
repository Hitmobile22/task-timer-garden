
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
    
    for (const setting of settings) {
      // Verify the setting is actually enabled
      if (!setting.enabled) {
        console.log(`Settings ID ${setting.id} is marked as not enabled, skipping`);
        continue;
      }
      
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
      
      const { data: existingTasks, error: existingTasksError } = await supabaseClient
        .from('Tasks')
        .select('id')
        .eq('task_list_id', setting.task_list_id)
        .gte('created_at', startOfToday.toISOString());

      if (existingTasksError) {
        console.error(`Error checking existing tasks for list ${taskListData.name}:`, existingTasksError);
        continue;
      }

      const existingCount = existingTasks?.length || 0;
      console.log(`Found ${existingCount} existing tasks for list ${taskListData.name}`);

      if (existingCount >= setting.daily_task_count) {
        console.log(`Tasks already generated today for list ${taskListData.name} (${setting.task_list_id})`);
        continue;
      }

      // Generate only the needed number of tasks
      const tasksToGenerate = setting.daily_task_count - existingCount;
      console.log(`Generating ${tasksToGenerate} tasks for list ${taskListData.name} (${setting.task_list_id})`);
      
      const taskDate = new Date();
      const baseTaskName = `${taskListData.name} - Task`;
      
      for (let i = 0; i < tasksToGenerate; i++) {
        const taskStartTime = new Date(taskDate);
        taskStartTime.setHours(9 + i * 2, 0, 0, 0); // Start at 9am, 2-hour increments
        
        const taskEndTime = new Date(taskStartTime);
        taskEndTime.setMinutes(taskEndTime.getMinutes() + 25); // 25-minute task
        
        const { data: taskData, error: taskError } = await supabaseClient
          .from('Tasks')
          .insert({
            "Task Name": `${baseTaskName} ${existingCount + i + 1}`,
            Progress: "Not started",
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            task_list_id: setting.task_list_id,
            order: existingCount + i,
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
