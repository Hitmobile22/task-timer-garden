import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getCurrentDayOfWeek() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const currentDayOfWeek = getCurrentDayOfWeek();
    console.log(`Current day of week: ${currentDayOfWeek}`);

    const body = await req.json();
    console.log("Received request body:", JSON.stringify(body));
    
    const forceCheck = !!body.forceCheck;
    const projects = body.projects || [];
    const specificDayOfWeek = body.dayOfWeek || currentDayOfWeek;

    console.log(`Processing ${projects.length} recurring projects on ${specificDayOfWeek}`);

    const results = [];
    
    const existingTaskNamesByProject = new Map();
    
    const projectTaskListIds = projects
      .map(p => p.task_list_id)
      .filter(id => id !== null && id !== undefined);
    
    const taskListSettingsMap = new Map();
    
    if (projectTaskListIds.length > 0) {
      const { data: taskListSettings, error: settingsError } = await supabaseClient
        .from('recurring_task_settings')
        .select('*')
        .in('task_list_id', projectTaskListIds)
        .eq('enabled', true)
        .order('created_at', { ascending: false });
        
      if (settingsError) {
        console.error('Error fetching task list settings:', settingsError);
      } else if (taskListSettings && taskListSettings.length > 0) {
        for (const setting of taskListSettings) {
          if (!setting.task_list_id) continue;
          
          if (!taskListSettingsMap.has(setting.task_list_id)) {
            taskListSettingsMap.set(setting.task_list_id, setting);
          }
        }
        
        console.log(`Retrieved settings for ${taskListSettingsMap.size} task lists`);
      }
    }
    
    for (const project of projects) {
      if (!project || !project.id) {
        console.log(`Invalid project data, skipping`);
        results.push({ project_id: project?.id, status: 'skipped', reason: 'invalid_project' });
        continue;
      }

      if (!project.date_started || !project.date_due) {
        console.log(`Project ${project.id} missing start/due dates, skipping`);
        results.push({ project_id: project.id, status: 'skipped', reason: 'missing_dates' });
        continue;
      }
      
      let shouldRunToday = true;
      if (!forceCheck && project.task_list_id) {
        const listSetting = taskListSettingsMap.get(project.task_list_id);
        if (listSetting && Array.isArray(listSetting.days_of_week)) {
          shouldRunToday = listSetting.days_of_week.includes(specificDayOfWeek);
          console.log(`Project ${project.id} task list ${project.task_list_id} configured days: ${listSetting.days_of_week.join(', ')}`);
          console.log(`Should run today (${specificDayOfWeek})? ${shouldRunToday}`);
        }
      }
      
      if (!shouldRunToday && !forceCheck) {
        console.log(`Project ${project.id} not scheduled to run on ${specificDayOfWeek}, skipping`);
        results.push({ 
          project_id: project.id, 
          status: 'skipped', 
          reason: 'not_scheduled_for_today',
          day: specificDayOfWeek
        });
        continue;
      }

      const startDate = new Date(project.date_started);
      const dueDate = new Date(project.date_due);
      startDate.setHours(0, 0, 0, 0);
      dueDate.setHours(23, 59, 59, 999);

      if (today < startDate || today > dueDate) {
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

      const { data: generationLogs, error: logsError } = await supabaseClient
        .from('recurring_task_generation_logs')
        .select('*')
        .eq('project_id', project.id)
        .gte('generation_date', today.toISOString())
        .lt('generation_date', tomorrow.toISOString())
        .maybeSingle();
        
      if (logsError) {
        console.error(`Error checking generation logs for project ${project.id}:`, logsError);
      } else if (generationLogs && !forceCheck) {
        console.log(`Already generated ${generationLogs.tasks_generated} tasks for project ${project.id} today, skipping`);
        results.push({ 
          project_id: project.id, 
          status: 'skipped', 
          reason: 'already_generated',
          existing: generationLogs.tasks_generated
        });
        continue;
      }

      const { data: todayTasks, error: todayTasksError } = await supabaseClient
        .from('Tasks')
        .select('id, "Task Name", Progress')
        .eq('project_id', project.id)
        .gte('date_started', today.toISOString())
        .lt('date_started', tomorrow.toISOString());

      if (todayTasksError) {
        console.error(`Error checking today's tasks for project ${project.id}:`, todayTasksError);
        results.push({ project_id: project.id, status: 'error', error: 'today_tasks_check_failed' });
        continue;
      }

      existingTaskNamesByProject.set(project.id, todayTasks?.map(task => task["Task Name"]) || []);

      const taskCount = project.recurringTaskCount || 1;
      const todayTaskCount = todayTasks?.length || 0;
      
      console.log(`Project ${project.id} has ${todayTaskCount} tasks today, daily goal is ${taskCount}`);
      
      if (todayTaskCount > 0 && !forceCheck) {
        const { error: logInsertError } = await supabaseClient
          .from('recurring_task_generation_logs')
          .insert({
            project_id: project.id,
            tasks_generated: todayTaskCount,
            generation_date: new Date().toISOString()
          });
          
        if (logInsertError) {
          console.error(`Error creating generation log for project ${project.id}:`, logInsertError);
        }
        
        console.log(`Found existing tasks for project ${project.id}, created generation log`);
        results.push({ project_id: project.id, status: 'skipped', reason: 'has_existing_tasks', existing: todayTaskCount });
        continue;
      }
      
      if (todayTaskCount >= taskCount && !forceCheck) {
        console.log(`No new tasks needed for project ${project.id} (${project['Project Name']}) - has ${todayTaskCount} tasks today`);
        results.push({ project_id: project.id, status: 'skipped', reason: 'has_enough_tasks_today', existing: todayTaskCount });
        continue;
      }
      
      const neededTasks = Math.max(0, taskCount - todayTaskCount);
      
      if (neededTasks <= 0) {
        console.log(`No new tasks needed for project ${project.id} (${project['Project Name']})`);
        results.push({ project_id: project.id, status: 'skipped', reason: 'has_enough_tasks', existing: todayTaskCount });
        continue;
      }

      const tasksToCreate = [];
      const existingNames = existingTaskNamesByProject.get(project.id) || [];
      
      for (let i = 0; i < neededTasks; i++) {
        const taskStartTime = new Date(today);
        taskStartTime.setHours(9, 0, 0, 0); 
        
        if (i > 0) {
          taskStartTime.setMinutes(taskStartTime.getMinutes() + (i * 30));
        }
        
        const taskEndTime = new Date(taskStartTime);
        taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25 min duration
        
        let taskName = `${project['Project Name']} - Task ${todayTaskCount + i + 1}`;
        let uniqueNameCounter = 1;
        
        while (existingNames.includes(taskName)) {
          taskName = `${project['Project Name']} - Task ${todayTaskCount + i + 1} (${uniqueNameCounter})`;
          uniqueNameCounter++;
        }
        
        existingNames.push(taskName);
        
        tasksToCreate.push({
          "Task Name": taskName,
          Progress: "Not started",
          date_started: taskStartTime.toISOString(),
          date_due: taskEndTime.toISOString(),
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
        
        const { error: logInsertError } = await supabaseClient
          .from('recurring_task_generation_logs')
          .insert({
            project_id: project.id,
            tasks_generated: newTasks.length,
            generation_date: new Date().toISOString()
          });
          
        if (logInsertError) {
          console.error(`Error creating generation log for project ${project.id}:`, logInsertError);
        }
        
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
