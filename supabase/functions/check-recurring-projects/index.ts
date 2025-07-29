
// Update the edge function to handle day-of-week restrictions for projects.
// This involves adding logic to check if a project should be processed based on the current day.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to normalize day names for consistent comparison
const normalizeDay = (day: string): string => 
  day?.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase()) || '';

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
    )
    
    // Parse request body
    const body = await req.json();
    console.log("Received request body:", JSON.stringify(body));
    
    // Process reset daily goals request if provided
    if (body.resetDailyGoals) {
      try {
        console.log("Resetting daily project goals");
        
        // Get the current date in server's timezone
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // First, check if we've already reset goals today using the log table
        const { data: resetLog, error: resetLogError } = await supabaseClient
          .from('recurring_task_generation_logs')
          .select('*')
          .eq('task_list_id', -1) // Special ID for daily goal resets
          .eq('setting_id', -1)   // Special ID for daily goal resets 
          .gte('generation_date', today.toISOString())
          .lt('generation_date', new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();
          
        if (resetLogError) {
          console.error('Error checking reset log:', resetLogError);
          // Continue anyway since this is just an optimization
        } else if (resetLog) {
          console.log('Daily goals already reset today according to log table:', resetLog);
          return new Response(
            JSON.stringify({ 
              success: true, 
              goalsReset: 0,
              message: `Daily goals already reset today at ${resetLog.generation_date}` 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          );
        }
        
        // Get goals that need to be reset
        const { data: dailyGoals, error } = await supabaseClient
          .from('project_goals')
          .select('*')
          .eq('goal_type', 'daily')
          .eq('is_enabled', true);
        
        if (error) throw error;
        
        let goalsReset = 0;
        
        // Reset each goal
        for (const goal of (dailyGoals || [])) {
          try {
            // Reset current count
            const { error: resetError } = await supabaseClient
              .from('project_goals')
              .update({ current_count: 0 })
              .eq('id', goal.id);
            
            if (!resetError) goalsReset++;
          } catch (err) {
            console.error(`Error resetting goal ${goal.id}:`, err);
          }
        }
        
        // Log this reset in the recurring_task_generation_logs table
        if (goalsReset > 0) {
          await supabaseClient
            .from('recurring_task_generation_logs')
            .insert({
              task_list_id: -1, // Special ID for daily goal resets
              setting_id: -1,   // Special ID for daily goal resets
              generation_date: new Date().toISOString(),
              tasks_generated: goalsReset,
              details: { reset_type: 'daily_goals' }
            });
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            goalsReset: goalsReset,
            message: `Reset ${goalsReset} daily project goals`
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      } catch (error) {
        console.error('Error resetting daily goals:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          }
        );
      }
    }
    
    // Handle recurring project task generation
    const projects = body.projects || [];
    const forceCheck = body.forceCheck || false;
    const results = [];
    
    // Get the current day of week (use the one from the client if available)
    const currentDay = body.dayOfWeek || new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const normalizedCurrentDay = normalizeDay(currentDay);
    
    console.log(`Processing ${projects.length} recurring projects on ${currentDay} (normalized: ${normalizedCurrentDay})`);
    
    // Process each project
    for (const project of projects) {
      try {
        if (!project.id || !project.isRecurring) {
          console.log('Skipping invalid project', project);
          results.push({
            project_id: project.id,
            status: 'skipped',
            reason: 'invalid_project'
          });
          continue;
        }
        
        // IMPROVED DAY CHECK: Check if this project should run today based on recurring settings
        // This is the key fix to ensure tasks are only created on specific days
        if (project.recurring_settings && project.recurring_settings.days_of_week && project.recurring_settings.days_of_week.length > 0) {
          // Extract and normalize the days of week from the project settings
          const projectDays = project.recurring_settings.days_of_week.map(normalizeDay);
          
          // Ensure strict day matching - only create tasks if today matches exactly
          const shouldRunToday = projectDays.includes(normalizedCurrentDay);
          
          console.log(`Project ${project.id} (${project['Project Name']}) days of week:`, 
            project.recurring_settings.days_of_week.join(', '),
            `- Should run today (${currentDay}): ${shouldRunToday}`);
          
          if (!shouldRunToday && !forceCheck) {
            console.log(`Project ${project.id} not scheduled for ${currentDay}, skipping`);
            results.push({
              project_id: project.id,
              status: 'skipped',
              reason: 'wrong_day',
              configured_days: project.recurring_settings.days_of_week,
              current_day: currentDay
            });
            continue;
          }
        }
        
        // Check for existing generation log for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const { data: existingLog, error: logError } = await supabaseClient
          .from('recurring_task_generation_logs')
          .select('*')
          .eq('project_id', project.id)
          .gte('generation_date', today.toISOString())
          .lt('generation_date', tomorrow.toISOString())
          .maybeSingle();
          
        if (logError) {
          console.error(`Error checking generation log for project ${project.id}:`, logError);
          results.push({
            project_id: project.id,
            status: 'error',
            error: 'log_check_failed'
          });
          continue;
        }
        
        if (existingLog && !forceCheck) {
          console.log(`Already generated ${existingLog.tasks_generated} tasks for project ${project.id} today, skipping`);
          results.push({
            project_id: project.id,
            status: 'skipped',
            reason: 'already_generated',
            existing: existingLog.tasks_generated
          });
          continue;
        }
        
        // IMPROVED: Count both active AND completed tasks for today to avoid duplicate generation
        // Get active tasks
        const { data: activeTasks, error: tasksError } = await supabaseClient
          .from('Tasks')
          .select('id')
          .eq('project_id', project.id)
          .in('Progress', ['Not started', 'In progress']);
          
        if (tasksError) {
          console.error(`Error checking active tasks for project ${project.id}:`, tasksError);
          results.push({
            project_id: project.id,
            status: 'error',
            error: 'task_check_failed'
          });
          continue;
        }
        
        // CRITICAL FIX: Also get tasks completed today
        const { data: completedTodayTasks, error: completedTasksError } = await supabaseClient
          .from('Tasks')
          .select('id')
          .eq('project_id', project.id)
          .eq('Progress', 'Completed')
          .gte('date_started', today.toISOString())
          .lt('date_started', tomorrow.toISOString());
          
        if (completedTasksError) {
          console.error(`Error checking completed tasks for project ${project.id}:`, completedTasksError);
          results.push({
            project_id: project.id,
            status: 'error',
            error: 'completed_task_check_failed'
          });
          continue;
        }
        
        const activeTaskCount = activeTasks?.length || 0;
        const completedTodayCount = completedTodayTasks?.length || 0;
        const totalRelevantTaskCount = activeTaskCount + completedTodayCount;
        const taskGoal = project.recurringTaskCount || 1;
        
        console.log(`Project ${project.id} has ${activeTaskCount} active tasks, ${completedTodayCount} completed today. Total: ${totalRelevantTaskCount} of ${taskGoal} goal`);
        
        if (totalRelevantTaskCount >= taskGoal && !forceCheck) {
          console.log(`Project ${project.id} already has enough tasks (including completed ones), skipping`);
          results.push({
            project_id: project.id,
            status: 'skipped',
            reason: 'enough_tasks',
            existing: activeTaskCount,
            completed: completedTodayCount,
            total: totalRelevantTaskCount
          });
          continue;
        }
        
        // Create tasks - but only the difference needed
        const tasksToCreate = Math.max(0, taskGoal - totalRelevantTaskCount);
        
        if (tasksToCreate <= 0) {
          console.log(`No tasks to create for project ${project.id}, skipping`);
          results.push({
            project_id: project.id,
            status: 'skipped',
            reason: 'no_tasks_needed'
          });
          continue;
        }
        
        console.log(`Creating ${tasksToCreate} tasks for project ${project.id}`);
        
        const newTasks = [];
        
        for (let i = 0; i < tasksToCreate; i++) {
          const taskStartTime = new Date(today);
          taskStartTime.setHours(13, 0 + (i * 30), 0, 0); // Changed from 9 to 13 for EST (9am EST = 1pm UTC)
          
          const taskEndTime = new Date(taskStartTime);
          taskEndTime.setMinutes(taskStartTime.getMinutes() + 25);
          
          // Remove the task number suffix to avoid (1), (2) etc. at the end of task names
          let taskName = `${project["Project Name"]} - Task`;
          
          newTasks.push({
            "Task Name": taskName,
            "Progress": "Not started",
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            project_id: project.id,
            task_list_id: project.task_list_id
          });
        }
        
        // Insert the tasks
        const { data: createdTasks, error: createError } = await supabaseClient
          .from('Tasks')
          .insert(newTasks)
          .select('id');
          
        if (createError) {
          console.error(`Error creating tasks for project ${project.id}:`, createError);
          results.push({
            project_id: project.id,
            status: 'error',
            error: 'task_creation_failed'
          });
          continue;
        }
        
        console.log(`Created ${createdTasks?.length || 0} tasks for project ${project.id}`);
        
        // Log the generation
        const tasksCreated = createdTasks?.length || 0;
        
        if (existingLog) {
          // Update existing log
          await supabaseClient
            .from('recurring_task_generation_logs')
            .update({
              tasks_generated: existingLog.tasks_generated + tasksCreated
            })
            .eq('id', existingLog.id);
        } else {
          // Create new log
          await supabaseClient
            .from('recurring_task_generation_logs')
            .insert({
              project_id: project.id,
              tasks_generated: tasksCreated,
              generation_date: new Date().toISOString()
            });
        }
        
        results.push({
          project_id: project.id,
          status: 'created',
          tasks_created: tasksCreated
        });
        
      } catch (error) {
        console.error(`Error processing project ${project?.id}:`, error);
        results.push({
          project_id: project?.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
    
  } catch (error) {
    console.error('Error processing recurring projects:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
