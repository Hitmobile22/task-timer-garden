
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
    console.log(`Current day of week: ${dayOfWeek}`);
    
    // Get unique task lists with recurring settings that include the current day of week
    const { data: uniqueTaskLists, error: uniqueListsError } = await supabaseClient
      .from('recurring_task_settings')
      .select('task_list_id')
      .eq('enabled', true)
      .contains('days_of_week', [dayOfWeek]);
    
    if (uniqueListsError) throw uniqueListsError;
    
    if (!uniqueTaskLists || uniqueTaskLists.length === 0) {
      console.log('No active recurring task settings for today');
      return new Response(JSON.stringify({ success: true, message: 'No active settings for today' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    // Get unique task list IDs
    const uniqueTaskListIds = [...new Set(uniqueTaskLists.map(item => item.task_list_id))];
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
      
      if (settingsError) throw settingsError;
      if (!settings || settings.length === 0) continue;
      
      const setting = settings[0];
      console.log(`Processing task list ${setting.task_list_id} with setting ID ${setting.id}`);
      console.log(`Days of week setting: ${setting.days_of_week.join(', ')}`);
      
      // Confirm this setting includes the current day of week
      if (!setting.days_of_week.includes(dayOfWeek)) {
        console.log(`Task list ${setting.task_list_id} does not have ${dayOfWeek} enabled, skipping`);
        continue;
      }
      
      // Get the associated task list
      const { data: taskListData, error: taskListError } = await supabaseClient
        .from('TaskLists')
        .select('*')
        .eq('id', setting.task_list_id)
        .single();
      
      if (taskListError) {
        console.error(`Error getting task list ${setting.task_list_id}:`, taskListError);
        continue;
      }
      
      // Define the midnight start of today for date filtering
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      
      // Get ALL active tasks for this list (both in progress and not started)
      const { data: activeTasks, error: activeTasksError } = await supabaseClient
        .from('Tasks')
        .select('id, "Task Name", Progress')
        .eq('task_list_id', setting.task_list_id)
        .in('Progress', ['Not started', 'In progress']);

      if (activeTasksError) {
        console.error(`Error checking active tasks for list ${taskListData.name}:`, activeTasksError);
        continue;
      }

      const activeTaskCount = activeTasks?.length || 0;
      console.log(`Found ${activeTaskCount} active tasks for list ${taskListData.name}`);

      // If we already have enough or more active tasks than the daily task count, skip creating new ones
      if (activeTaskCount >= setting.daily_task_count) {
        console.log(`Already have ${activeTaskCount} active tasks for list ${taskListData.name} (${setting.task_list_id}), which meets the daily goal of ${setting.daily_task_count}`);
        continue;
      }

      // Generate only the needed number of tasks
      const tasksToGenerate = setting.daily_task_count - activeTaskCount;
      console.log(`Generating ${tasksToGenerate} tasks for list ${taskListData.name} (${setting.task_list_id})`);
      
      // Always start tasks at 9am with 30-minute increments
      const baseTaskName = `${taskListData.name} - Task`;
      
      // Get the highest task number to prevent duplicate numbering
      let highestTaskNumber = 0;
      if (activeTasks && activeTasks.length > 0) {
        for (const task of activeTasks) {
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
        
        // Always start at 9am with 30-minute increments
        const taskStartTime = new Date(today);
        taskStartTime.setHours(9, i * 30, 0, 0); // 9:00, 9:30, 10:00, etc.
        
        const taskEndTime = new Date(taskStartTime);
        taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25-minute task
        
        const { data: taskData, error: taskError } = await supabaseClient
          .from('Tasks')
          .insert({
            "Task Name": `${baseTaskName} ${taskNumber}`,
            Progress: "Not started",
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            task_list_id: setting.task_list_id,
            order: activeTaskCount + i,
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
