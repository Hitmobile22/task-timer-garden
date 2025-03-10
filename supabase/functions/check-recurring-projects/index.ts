
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Auth context
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find projects that are recurring and should generate tasks today
    const { data: projects, error: projectsError } = await supabaseClient
      .from('Projects')
      .select('*')
      .eq('isRecurring', true)
      .neq('progress', 'Completed');

    if (projectsError) {
      throw projectsError;
    }

    console.log(`Found ${projects.length} recurring projects to check`);

    const results = [];
    
    for (const project of projects) {
      // Skip if project doesn't have start/due dates
      if (!project.date_started || !project.date_due) {
        console.log(`Project ${project.id} missing start/due dates, skipping`);
        results.push({ project_id: project.id, status: 'skipped', reason: 'missing_dates' });
        continue;
      }

      const startDate = new Date(project.date_started);
      const dueDate = new Date(project.date_due);
      startDate.setHours(0, 0, 0, 0);
      dueDate.setHours(23, 59, 59, 999);

      // Skip if today is outside the project date range
      if (today < startDate || today > dueDate) {
        // Check if project is overdue and update name if needed
        if (today > dueDate && !project['Project Name'].includes('(overdue)')) {
          const { error: updateError } = await supabaseClient
            .from('Projects')
            .update({ 'Project Name': `${project['Project Name']} (overdue)` })
            .eq('id', project.id);
          
          if (updateError) {
            console.error(`Error updating overdue project ${project.id}:`, updateError);
          } else {
            console.log(`Marked project ${project.id} as overdue`);
          }
        }
        
        console.log(`Project ${project.id} not active today, skipping`);
        results.push({ project_id: project.id, status: 'skipped', reason: 'outside_date_range' });
        continue;
      }

      // Check if tasks were already created today by looking at created_at
      const { data: tasksCreatedToday, error: createdTodayError } = await supabaseClient
        .from('Tasks')
        .select('id')
        .eq('project_id', project.id)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString());

      if (createdTodayError) {
        console.error(`Error checking tasks created today for project ${project.id}:`, createdTodayError);
        results.push({ project_id: project.id, status: 'error', error: 'created_today_check_failed' });
        continue;
      }

      // Skip if tasks were already created today
      if (tasksCreatedToday && tasksCreatedToday.length > 0) {
        console.log(`Already created ${tasksCreatedToday.length} tasks today for project ${project.id}, skipping`);
        results.push({ project_id: project.id, status: 'skipped', reason: 'tasks_already_created_today', count: tasksCreatedToday.length });
        continue;
      }

      // Count existing active tasks for today
      const { data: existingTasks, error: existingTasksError } = await supabaseClient
        .from('Tasks')
        .select('id')
        .eq('project_id', project.id)
        .in('Progress', ['Not started', 'In progress'])
        .gte('date_started', today.toISOString())
        .lt('date_started', tomorrow.toISOString());

      if (existingTasksError) {
        console.error(`Error checking existing tasks for project ${project.id}:`, existingTasksError);
        results.push({ project_id: project.id, status: 'error', error: 'existing_tasks_check_failed' });
        continue;
      }

      // Calculate how many tasks to add
      const taskCount = project.recurringTaskCount || 1;
      const existingCount = existingTasks?.length || 0;
      const neededTasks = Math.max(0, taskCount - existingCount);
      
      if (neededTasks <= 0) {
        console.log(`No new tasks needed for project ${project.id} (${project['Project Name']})`);
        results.push({ project_id: project.id, status: 'skipped', reason: 'has_enough_tasks', existing: existingCount });
        continue;
      }

      // Create new tasks for today
      const tasksToCreate = [];
      
      for (let i = 0; i < neededTasks; i++) {
        const now = new Date();
        const startTime = new Date(now.getTime() + (i * 30 * 60 * 1000)); // 30 min spacing
        const endTime = new Date(startTime.getTime() + (25 * 60 * 1000)); // 25 min duration
        
        tasksToCreate.push({
          "Task Name": `${project['Project Name']} - Task ${existingCount + i + 1}`,
          Progress: "Not started",
          date_started: startTime.toISOString(),
          date_due: endTime.toISOString(),
          task_list_id: project.task_list_id || 1,
          project_id: project.id
        });
      }

      console.log(`Creating ${tasksToCreate.length} new tasks for project ${project.id}`);

      if (tasksToCreate.length > 0) {
        const { data: newTasks, error: createError } = await supabaseClient
          .from('Tasks')
          .insert(tasksToCreate)
          .select();

        if (createError) {
          console.error(`Error creating tasks for project ${project.id}:`, createError);
          results.push({ project_id: project.id, status: 'error', error: 'task_creation_failed' });
          continue;
        }

        console.log(`Created ${newTasks.length} tasks for project ${project.id}`);
        results.push({ project_id: project.id, status: 'created', tasks_created: newTasks.length });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Error checking recurring projects:', error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
