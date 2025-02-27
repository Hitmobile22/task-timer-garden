
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
        continue;
      }

      // Check if tasks were already created today for this project
      const { data: existingTasks, error: existingTasksError } = await supabaseClient
        .from('Tasks')
        .select('id')
        .eq('project_id', project.id)
        .gte('created_at', today.toISOString())
        .lt('created_at', new Date(today.getTime() + 86400000).toISOString());

      if (existingTasksError) {
        console.error(`Error checking existing tasks for project ${project.id}:`, existingTasksError);
        continue;
      }

      // Skip if tasks were already created today
      if (existingTasks && existingTasks.length > 0) {
        console.log(`Already created ${existingTasks.length} tasks today for project ${project.id}, skipping`);
        continue;
      }

      // Create new tasks for today
      const tasksToCreate = [];
      const taskCount = project.recurringTaskCount || 1;
      
      for (let i = 0; i < taskCount; i++) {
        const now = new Date();
        const startTime = new Date(now.getTime() + (i * 30 * 60 * 1000)); // 30 min spacing
        const endTime = new Date(startTime.getTime() + (25 * 60 * 1000)); // 25 min duration
        
        tasksToCreate.push({
          "Task Name": `${project['Project Name']} - Task ${i + 1}`,
          Progress: "Not started",
          date_started: startTime.toISOString(),
          date_due: endTime.toISOString(),
          task_list_id: project.task_list_id || 1,
          project_id: project.id
        });
      }

      if (tasksToCreate.length > 0) {
        const { data: newTasks, error: createError } = await supabaseClient
          .from('Tasks')
          .insert(tasksToCreate)
          .select();

        if (createError) {
          console.error(`Error creating tasks for project ${project.id}:`, createError);
          continue;
        }

        console.log(`Created ${newTasks.length} tasks for project ${project.id}`);
        results.push({ project_id: project.id, tasks_created: newTasks.length });
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
