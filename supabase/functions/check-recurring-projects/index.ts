
// Update the edge function to handle day-of-week restrictions for projects.
// This involves adding logic to check if a project should be processed based on the current day.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { toZonedTime, fromZonedTime } from 'npm:date-fns-tz@3.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to normalize day names for consistent comparison
const normalizeDay = (day: string): string => 
  day?.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase()) || '';

// Type for subtask modes
type SubtaskMode = 'on_task_creation' | 'progressive' | 'daily' | 'every_x_days' | 'every_x_weeks' | 'days_of_week';

// Helper function to check if subtasks should respawn based on mode and timing
function checkIfShouldRespawn(
  settings: any, 
  estNow: Date, 
  currentDay: string
): boolean {
  const lastRespawn = settings.last_subtask_respawn 
    ? new Date(settings.last_subtask_respawn) 
    : null;
  
  switch (settings.subtask_mode as SubtaskMode) {
    case 'daily':
      // Respawn if it's a new day (past midnight EST)
      if (!lastRespawn) return true;
      const lastRespawnEST = toZonedTime(lastRespawn, 'America/New_York');
      return estNow.toDateString() !== lastRespawnEST.toDateString();
      
    case 'every_x_days':
      if (!lastRespawn) return true;
      const daysDiff = Math.floor((estNow.getTime() - lastRespawn.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= (settings.respawn_interval_value || 1);
      
    case 'every_x_weeks':
      if (!lastRespawn) return true;
      const weeksDiff = Math.floor((estNow.getTime() - lastRespawn.getTime()) / (1000 * 60 * 60 * 24 * 7));
      return weeksDiff >= (settings.respawn_interval_value || 1);
      
    case 'days_of_week':
      const normalizedCurrentDay = normalizeDay(currentDay);
      const respawnDays = (settings.respawn_days_of_week || []).map(normalizeDay);
      if (!respawnDays.includes(normalizedCurrentDay)) return false;
      if (!lastRespawn) return true;
      const lastRespawnESTDow = toZonedTime(lastRespawn, 'America/New_York');
      return estNow.toDateString() !== lastRespawnESTDow.toDateString();
      
    default:
      return false;
  }
}

// Function to respawn subtasks for projects that need it
async function checkSubtaskRespawns(supabaseClient: any, userId: string) {
  console.log('Checking for subtask respawns...');
  
  const now = new Date();
  const estNow = toZonedTime(now, 'America/New_York');
  const currentDay = estNow.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Get all project settings that might need respawn
  const { data: allSettings, error: settingsError } = await supabaseClient
    .from('recurring_project_settings')
    .select('*, project_id')
    .eq('user_id', userId)
    .in('subtask_mode', ['daily', 'every_x_days', 'every_x_weeks', 'days_of_week']);
  
  if (settingsError) {
    console.error('Error fetching project settings for subtask respawn:', settingsError);
    return { respawned: 0, errors: 1 };
  }
  
  let respawnedCount = 0;
  let errorsCount = 0;
  
  for (const settings of (allSettings || [])) {
    try {
      const shouldRespawn = checkIfShouldRespawn(settings, estNow, currentDay);
      
      if (!shouldRespawn) {
        console.log(`Project ${settings.project_id} - no respawn needed (mode: ${settings.subtask_mode})`);
        continue;
      }
      
      console.log(`Project ${settings.project_id} - respawning subtasks (mode: ${settings.subtask_mode})`);
      
      // Get all active tasks for this project
      const { data: activeTasks, error: tasksError } = await supabaseClient
        .from('Tasks')
        .select('id')
        .eq('project_id', settings.project_id)
        .in('Progress', ['Not started', 'In progress']);
      
      if (tasksError) {
        console.error(`Error fetching tasks for project ${settings.project_id}:`, tasksError);
        errorsCount++;
        continue;
      }
      
      const subtaskTemplate = settings.subtask_names || [];
      if (subtaskTemplate.length === 0) {
        console.log(`Project ${settings.project_id} - no subtask template defined, skipping`);
        continue;
      }
      
      // For each active task, ensure all template subtasks exist
      for (const task of (activeTasks || [])) {
        const { data: existingSubtasks, error: subtasksError } = await supabaseClient
          .from('subtasks')
          .select('"Task Name"')
          .eq('Parent Task ID', task.id);
        
        if (subtasksError) {
          console.error(`Error fetching subtasks for task ${task.id}:`, subtasksError);
          continue;
        }
        
        const existingNames = existingSubtasks?.map((s: any) => s['Task Name']) || [];
        
        // Add missing subtasks (no duplicates)
        const newSubtasks = subtaskTemplate
          .filter((name: string) => !existingNames.includes(name) && name.trim())
          .map((name: string, index: number) => ({
            'Task Name': name,
            'Parent Task ID': task.id,
            'Progress': 'Not started',
            'user_id': userId,
            'sort_order': existingNames.length + index
          }));
        
        if (newSubtasks.length > 0) {
          const { error: insertError } = await supabaseClient
            .from('subtasks')
            .insert(newSubtasks);
          
          if (insertError) {
            console.error(`Error inserting subtasks for task ${task.id}:`, insertError);
          } else {
            console.log(`Respawned ${newSubtasks.length} subtasks for task ${task.id}`);
            respawnedCount += newSubtasks.length;
          }
        }
      }
      
      // Update last_subtask_respawn timestamp
      const { error: updateError } = await supabaseClient
        .from('recurring_project_settings')
        .update({ last_subtask_respawn: now.toISOString() })
        .eq('id', settings.id);
      
      if (updateError) {
        console.error(`Error updating last_subtask_respawn for project ${settings.project_id}:`, updateError);
      }
      
    } catch (error) {
      console.error(`Error processing subtask respawn for project ${settings.project_id}:`, error);
      errorsCount++;
    }
  }
  
  return { respawned: respawnedCount, errors: errorsCount };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    // Get the authorization header first
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required - missing bearer token' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create a Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { 
          headers: { 
            Authorization: authHeader 
          } 
        } 
      }
    )
    
    // Get the authenticated user using the token
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        }
      );
    }
    
    console.log('Authenticated user:', user.id);
    
    // Parse request body
    const body = await req.json();
    console.log("Received request body:", JSON.stringify(body));
    
    // Check for subtask respawns FIRST, before any other processing
    // This runs every time the function is called
    try {
      const respawnResult = await checkSubtaskRespawns(supabaseClient, user.id);
      console.log(`Subtask respawn check complete: ${respawnResult.respawned} respawned, ${respawnResult.errors} errors`);
    } catch (respawnError) {
      console.error('Error during subtask respawn check:', respawnError);
      // Continue with the rest of the function - this shouldn't block other operations
    }
    
    // Process reset daily goals request if provided
    if (body.resetDailyGoals) {
      try {
        console.log("Resetting daily project goals");
        
        // Get the current date in EST timezone (matching frontend pattern)
        const now = new Date();
        const estNow = toZonedTime(now, 'America/New_York');
        const todayMidnightEST = new Date(estNow);
        todayMidnightEST.setHours(0, 0, 0, 0);
        const today = fromZonedTime(todayMidnightEST, 'America/New_York');
        
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
              details: { reset_type: 'daily_goals' },
              user_id: user.id // Add user_id to comply with RLS policy
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
        
        // Check for existing generation log for today (using EST timezone)
        const now = new Date();
        const estNow = toZonedTime(now, 'America/New_York');
        
        // Get today's midnight in EST
        const todayMidnightEST = new Date(estNow);
        todayMidnightEST.setHours(0, 0, 0, 0);
        
        // Get tomorrow's midnight in EST
        const tomorrowMidnightEST = new Date(todayMidnightEST);
        tomorrowMidnightEST.setDate(tomorrowMidnightEST.getDate() + 1);
        
        // Convert EST boundaries back to UTC for database queries
        const today = fromZonedTime(todayMidnightEST, 'America/New_York');
        const tomorrow = fromZonedTime(tomorrowMidnightEST, 'America/New_York');
        
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
        
        // Extract project description to copy to tasks
        let taskDetails = null;
        if (project.details) {
          try {
            const projectDetails = typeof project.details === 'string' 
              ? JSON.parse(project.details) 
              : project.details;
            if (projectDetails?.description) {
              taskDetails = { description: projectDetails.description };
            }
          } catch (e) {
            console.error('Error parsing project details:', e);
          }
        }
        
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
            task_list_id: project.task_list_id,
            user_id: user.id,
            details: taskDetails  // Copy project description to task
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
        
        // Create subtasks for each task created
        if (createdTasks && createdTasks.length > 0) {
          const { data: projectSettings } = await supabaseClient
            .from('recurring_project_settings')
            .select('subtask_names')
            .eq('project_id', project.id)
            .maybeSingle();
            
          if (projectSettings?.subtask_names && projectSettings.subtask_names.length > 0) {
            const subtasksToInsert = [];
            for (const task of createdTasks) {
              // Use index as sort_order to preserve array order
              projectSettings.subtask_names.forEach((subtaskName: string, index: number) => {
                if (subtaskName.trim()) {
                  subtasksToInsert.push({
                    "Task Name": subtaskName,
                    "Progress": "Not started",
                    "Parent Task ID": task.id,
                    "user_id": user.id,
                    "sort_order": index
                  });
                }
              });
            }
            
            if (subtasksToInsert.length > 0) {
              const { error: subtaskError } = await supabaseClient
                .from('subtasks')
                .insert(subtasksToInsert);
                
              if (subtaskError) {
                console.error(`Error creating subtasks for project ${project.id}:`, subtaskError);
              } else {
                console.log(`Created ${subtasksToInsert.length} subtasks for project ${project.id}`);
              }
            }
          }
        }
        
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
              generation_date: new Date().toISOString(),
              user_id: user.id  // Add user_id to comply with RLS policy
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
