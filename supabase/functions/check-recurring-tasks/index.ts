import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
)

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { data: taskLists, error: taskListsError } = await supabase
      .from('TaskLists')
      .select('*');

    if (taskListsError) {
      throw new Error(`Error fetching task lists: ${taskListsError.message}`);
    }

    for (const taskList of taskLists) {
      // Fetch recurring task settings for the current task list
      const { data: recurringSettings, error: recurringSettingsError } = await supabase
        .from('recurring_task_settings')
        .select('*')
        .eq('task_list_id', taskList.id)
        .eq('enabled', true)
        .limit(1)
        .single();

      if (recurringSettingsError) {
        console.error(`Error fetching recurring settings for task list ${taskList.id}: ${recurringSettingsError.message}`);
        continue; // Skip to the next task list
      }

      if (!recurringSettings) {
        console.log(`No enabled recurring task settings found for task list ${taskList.id}. Skipping.`);
        continue; // Skip to the next task list if no settings are enabled
      }

      // Check if the current day is a day when tasks should be created
      const today = new Date();
      const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
      if (!recurringSettings.days_of_week?.includes(dayOfWeek)) {
        console.log(`Today is not a day for recurring tasks for task list ${taskList.id}. Skipping.`);
        continue; // Skip if today is not a scheduled day
      }

      // Fetch tasks for the current task_list that are not completed
      const { data: existingTasks, error: existingTasksError } = await supabase
        .from('Tasks')
        .select('count')
        .eq('task_list_id', taskList.id)
        .eq('Progress', 'Not started')

      if (existingTasksError) {
        console.error(`Error fetching existing tasks for task list ${taskList.id}: ${existingTasksError.message}`);
        continue; // Skip to the next task list
      }

      const existingTaskCount = existingTasks.length > 0 ? existingTasks[0].count : 0;

      // If the number of existing tasks is less than the daily_task_count, create new tasks
      if (existingTaskCount < recurringSettings.daily_task_count!) {
        const tasksToCreate = recurringSettings.daily_task_count! - existingTaskCount;
        console.log(`Creating ${tasksToCreate} new tasks for task list ${taskList.id}`);

        for (let i = 0; i < tasksToCreate; i++) {
          const newTask = {
            "Task Name": `Recurring Task ${i + 1}`,
            task_list_id: taskList.id,
            Progress: 'Not started',
            sort_order: 1, // You might want to adjust the sort order logic
            order: 1,
            position: 1,
            created_at: new Date().toISOString(),
          };

          const { error: createTaskError } = await supabase
            .from('Tasks')
            .insert([newTask]);

          if (createTaskError) {
            console.error(`Error creating task for task list ${taskList.id}: ${createTaskError.message}`);
          } else {
            console.log(`Created task ${i + 1} for task list ${taskList.id}`);
          }
        }
      } else {
        console.log(`No new tasks to create for task list ${taskList.id}.`);
      }

      // Update the last_tasks_added_at timestamp in TaskLists table
      const { error: updateTaskListError } = await supabase
        .from('TaskLists')
        .update({ last_tasks_added_at: new Date().toISOString() })
        .eq('id', taskList.id);

      if (updateTaskListError) {
        console.error(`Error updating last_tasks_added_at for task list ${taskList.id}: ${updateTaskListError.message}`);
      } else {
        console.log(`Updated last_tasks_added_at for task list ${taskList.id}`);
      }
    }

    return new Response(
      JSON.stringify({ message: 'Recurring task check completed successfully.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-recurring-tasks function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
