
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

    // Get current day of week
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });
    
    // Get all enabled recurring task settings
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

    // Process each task list that needs recurring tasks
    for (const setting of (settings as RecurringTaskSettings[] || [])) {
      // Get task list info
      const { data: taskList } = await supabaseClient
        .from('TaskLists')
        .select('*')
        .eq('id', setting.task_list_id)
        .single();

      if (!taskList) continue;

      // Check if we already added tasks today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

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

      if (neededTasks > 0) {
        const newTasks = Array.from({ length: neededTasks }, (_, i) => ({
          "Task Name": `${taskList.name} ${existingCount + i + 1}`,
          Progress: "Not started",
          task_list_id: setting.task_list_id,
          date_started: new Date().toISOString(),
          date_due: new Date(new Date().setHours(new Date().getHours() + 1)).toISOString(),
          order: existingCount + i,
          archived: false,
        }));

        const { error: insertError } = await supabaseClient
          .from('Tasks')
          .insert(newTasks);

        if (insertError) throw insertError;

        // Update last_tasks_added_at
        await supabaseClient
          .from('TaskLists')
          .update({ last_tasks_added_at: new Date().toISOString() })
          .eq('id', setting.task_list_id);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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
