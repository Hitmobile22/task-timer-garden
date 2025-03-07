
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
    
    // Get all enabled recurring task settings for today
    const { data: settings, error: settingsError } = await supabaseClient
      .from('recurring_task_settings')
      .select(`
        id,
        task_list_id,
        enabled,
        daily_task_count,
        days_of_week
      `)
      .eq('enabled', true)
      .contains('days_of_week', [dayOfWeek]);

    if (settingsError) throw settingsError;

    console.log(`Found ${settings?.length || 0} recurring task settings for ${dayOfWeek}`);

    // Process each task list that needs recurring tasks
    for (const setting of (settings as RecurringTaskSettings[] || [])) {
      // Get task list info and check last_tasks_added_at
      const { data: taskList } = await supabaseClient
        .from('TaskLists')
        .select('*')
        .eq('id', setting.task_list_id)
        .single();

      if (!taskList) {
        console.log(`TaskList ${setting.task_list_id} not found, skipping`);
        continue;
      }

      // Check if tasks have already been added today
      const lastAddedDate = taskList.last_tasks_added_at ? new Date(taskList.last_tasks_added_at) : null;
      const hasAddedToday = lastAddedDate && 
        lastAddedDate.getDate() === today.getDate() &&
        lastAddedDate.getMonth() === today.getMonth() &&
        lastAddedDate.getFullYear() === today.getFullYear();

      if (hasAddedToday) {
        console.log(`Tasks already added today for list ${taskList.id} (${taskList.name})`);
        continue;
      }

      // Prevent duplicate task creation by using a transaction
      try {
        // First update the last_tasks_added_at timestamp to prevent race conditions
        const { error: updateError } = await supabaseClient
          .from('TaskLists')
          .update({ 
            last_tasks_added_at: new Date().toISOString() 
          })
          .eq('id', setting.task_list_id);

        if (updateError) throw updateError;

        // Count existing active tasks for today
        const { data: existingTasks, error: countError } = await supabaseClient
          .from('Tasks')
          .select('id')
          .eq('task_list_id', setting.task_list_id)
          .in('Progress', ['Not started', 'In progress'])
          .gte('date_started', startOfDay.toISOString());

        if (countError) throw countError;

        const existingCount = existingTasks?.length || 0;
        const neededTasks = Math.max(0, setting.daily_task_count - existingCount);

        console.log(`List ${taskList.id} (${taskList.name}): Has ${existingCount} tasks, needs ${neededTasks} more`);

        if (neededTasks > 0) {
          // Create tasks starting at current time with 30 min intervals
          const startingTime = new Date();
          // If it's early morning, start at 9am
          if (startingTime.getHours() < 9) {
            startingTime.setHours(9, 0, 0, 0);
          }

          const newTasks = Array.from({ length: neededTasks }, (_, i) => {
            const taskStartTime = new Date(startingTime);
            taskStartTime.setMinutes(startingTime.getMinutes() + (i * 30));
            
            const taskEndTime = new Date(taskStartTime);
            taskEndTime.setMinutes(taskStartTime.getMinutes() + 25);

            return {
              "Task Name": `${taskList.name} ${existingCount + i + 1}`,
              Progress: "Not started",
              task_list_id: setting.task_list_id,
              date_started: taskStartTime.toISOString(),
              date_due: taskEndTime.toISOString(),
              order: existingCount + i,
              archived: false,
            };
          });

          console.log(`Creating ${newTasks.length} new tasks for list ${taskList.id} (${taskList.name})`);

          if (newTasks.length > 0) {
            const { error: insertError } = await supabaseClient
              .from('Tasks')
              .insert(newTasks);

            if (insertError) {
              console.error('Error inserting tasks:', insertError);
              throw insertError;
            }
            
            console.log(`Successfully created tasks for list ${taskList.id}`);
          }
        } else {
          console.log(`No new tasks needed for list ${taskList.id} (${taskList.name})`);
        }
      } catch (error) {
        console.error(`Error processing task list ${taskList.id}:`, error);
        // If there was an error in the transaction, revert the last_tasks_added_at timestamp
        await supabaseClient
          .from('TaskLists')
          .update({ 
            last_tasks_added_at: lastAddedDate ? lastAddedDate.toISOString() : null 
          })
          .eq('id', setting.task_list_id);
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Processed ${settings?.length || 0} recurring task settings`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error in check-recurring-tasks:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
