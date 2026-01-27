import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import { toZonedTime, fromZonedTime } from 'npm:date-fns-tz@3.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get EST day boundaries (day starts at 3 AM EST)
function getESTDayBoundaries() {
  const now = new Date();
  const estNow = toZonedTime(now, 'America/New_York');
  const estHour = estNow.getHours();
  
  // Day starts at 3 AM EST
  // If before 3 AM, we're still in "yesterday"
  const dayStartEST = new Date(estNow);
  if (estHour < 3) {
    dayStartEST.setDate(dayStartEST.getDate() - 1);
  }
  dayStartEST.setHours(3, 0, 0, 0);
  
  const dayEndEST = new Date(dayStartEST);
  dayEndEST.setDate(dayEndEST.getDate() + 1);
  
  // Convert EST boundaries back to UTC for database queries
  const dayStartUTC = fromZonedTime(dayStartEST, 'America/New_York');
  const dayEndUTC = fromZonedTime(dayEndEST, 'America/New_York');
  
  // Get day name in EST
  const estDayName = estNow.toLocaleDateString('en-US', { weekday: 'long' });
  
  return { 
    now, 
    estNow, 
    estHour, 
    dayStartUTC, 
    dayEndUTC, 
    dayStartEST, 
    dayEndEST,
    estDayName
  };
}

// Helper function to update or create generation log entry
async function updateGenerationLog(
  supabaseClient: any, 
  taskListId: number, 
  settingId: number, 
  tasksGenerated: number,
  userId?: string
) {
  try {
    // Use EST day boundaries (3 AM EST to 3 AM EST)
    const { dayStartUTC, dayEndUTC } = getESTDayBoundaries();
    
    const { data: existingLog, error: selectError } = await supabaseClient
      .from('recurring_task_generation_logs')
      .select('id')
      .eq('task_list_id', taskListId)
      .eq('setting_id', settingId)
      .gte('generation_date', dayStartUTC.toISOString())
      .lt('generation_date', dayEndUTC.toISOString())
      .maybeSingle();
      
    if (selectError) {
      console.error('Error checking for existing generation log:', selectError);
      return;
    }
    
    if (existingLog) {
      // Update existing record
      const { error: updateError } = await supabaseClient
        .from('recurring_task_generation_logs')
        .update({ tasks_generated: tasksGenerated })
        .eq('id', existingLog.id);
        
      if (updateError) {
        console.error('Error updating generation log:', updateError);
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabaseClient
        .from('recurring_task_generation_logs')
        .insert({
          task_list_id: taskListId,
          setting_id: settingId,
          tasks_generated: tasksGenerated,
          generation_date: new Date().toISOString(),
          user_id: userId  // Add user_id to comply with RLS policy
        });
        
      if (insertError) {
        console.error('Error creating generation log:', insertError);
      }
    }
  } catch (error) {
    console.error('Error in updateGenerationLog:', error);
  }
}

// Semaphore to prevent concurrent processing of the same task list
const processingLists = new Set();

// Cache to prevent duplicate task generation
const generationCache = new Map();

// Helper function to normalize day names for consistent comparison
const normalizeDay = (day: string): string => 
  day?.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase()) || '';

interface RecurringTaskSetting {
  id: number;
  task_list_id: number;
  enabled: boolean;
  daily_task_count: number;
  days_of_week: string[];
  subtask_names?: string[];
  subtask_mode?: string;
  respawn_interval_value?: number;
  respawn_days_of_week?: string[];
  last_subtask_respawn?: string;
  user_id?: string;
  created_at?: string;
}

type SubtaskMode = 'on_task_creation' | 'progressive' | 'daily' | 'every_x_days' | 'every_x_weeks' | 'days_of_week';

// Check if subtasks should respawn based on mode and settings (using EST)
function checkIfShouldRespawn(settings: RecurringTaskSetting, estNow: Date, currentDay: string): boolean {
  const mode = settings.subtask_mode as SubtaskMode || 'on_task_creation';
  
  // These modes don't support respawning
  if (mode === 'on_task_creation' || mode === 'progressive') {
    return false;
  }
  
  const lastRespawn = settings.last_subtask_respawn ? new Date(settings.last_subtask_respawn) : null;
  
  if (mode === 'daily') {
    // Respawn if we haven't respawned today (using 3 AM EST boundary)
    if (!lastRespawn) return true;
    const lastRespawnEST = toZonedTime(lastRespawn, 'America/New_York');
    // Compare dates based on 3 AM boundary
    const { dayStartEST } = getESTDayBoundaries();
    return lastRespawnEST.getTime() < dayStartEST.getTime();
  }
  
  if (mode === 'every_x_days') {
    if (!lastRespawn) return true;
    const intervalDays = settings.respawn_interval_value || 1;
    const daysSinceRespawn = Math.floor((estNow.getTime() - lastRespawn.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceRespawn >= intervalDays;
  }
  
  if (mode === 'every_x_weeks') {
    if (!lastRespawn) return true;
    const intervalWeeks = settings.respawn_interval_value || 1;
    const weeksSinceRespawn = Math.floor((estNow.getTime() - lastRespawn.getTime()) / (1000 * 60 * 60 * 24 * 7));
    return weeksSinceRespawn >= intervalWeeks;
  }
  
  if (mode === 'days_of_week') {
    // Respawn if current day is in the respawn days
    const respawnDays = (settings.respawn_days_of_week || []).map(normalizeDay);
    const normalizedCurrentDay = normalizeDay(currentDay);
    
    if (!respawnDays.includes(normalizedCurrentDay)) {
      return false;
    }
    
    // Check if we've already respawned today (using 3 AM EST boundary)
    if (!lastRespawn) return true;
    const lastRespawnEST = toZonedTime(lastRespawn, 'America/New_York');
    const { dayStartEST } = getESTDayBoundaries();
    return lastRespawnEST.getTime() < dayStartEST.getTime();
  }
  
  return false;
}

// Check and respawn subtasks for task list settings
async function checkSubtaskRespawns(supabaseClient: any) {
  console.log('Checking for subtask respawns...');
  
  const { now, estNow, estDayName } = getESTDayBoundaries();
  const currentDay = estDayName;
  
  // Get all task list settings that might need respawn
  const { data: allSettings, error } = await supabaseClient
    .from('recurring_task_settings')
    .select('*')
    .eq('enabled', true)
    .in('subtask_mode', ['daily', 'every_x_days', 'every_x_weeks', 'days_of_week']);
  
  if (error) {
    console.error('Error fetching settings for subtask respawn:', error);
    return;
  }
  
  console.log(`Found ${allSettings?.length || 0} settings to check for subtask respawn`);
  
  for (const settings of (allSettings || [])) {
    const shouldRespawn = checkIfShouldRespawn(settings, estNow, currentDay);
    
    if (!shouldRespawn) {
      console.log(`Task list ${settings.task_list_id} does not need subtask respawn`);
      continue;
    }
    
    console.log(`Task list ${settings.task_list_id} needs subtask respawn (mode: ${settings.subtask_mode})`);
    
    // Get active tasks in this task list
    const { data: activeTasks, error: tasksError } = await supabaseClient
      .from('Tasks')
      .select('id, user_id')
      .eq('task_list_id', settings.task_list_id)
      .in('Progress', ['Not started', 'In progress']);
    
    if (tasksError) {
      console.error(`Error fetching active tasks for list ${settings.task_list_id}:`, tasksError);
      continue;
    }
    
    if (!activeTasks || activeTasks.length === 0) {
      console.log(`No active tasks in list ${settings.task_list_id}, skipping subtask respawn`);
      // Still update last_subtask_respawn to prevent repeated checks
      await supabaseClient
        .from('recurring_task_settings')
        .update({ last_subtask_respawn: now.toISOString() })
        .eq('id', settings.id);
      continue;
    }
    
    const subtaskTemplate = settings.subtask_names || [];
    if (subtaskTemplate.length === 0) {
      console.log(`No subtask template for list ${settings.task_list_id}, skipping`);
      continue;
    }
    
    let totalSubtasksReset = 0;
    let totalSubtasksAdded = 0;
    
    // For each task, reset existing template subtasks AND add missing ones
    for (const task of activeTasks) {
      // First, reset any existing template subtasks that are completed back to Not started
      const { error: resetError, count: resetCount } = await supabaseClient
        .from('subtasks')
        .update({ Progress: 'Not started', completed_at: null })
        .eq('Parent Task ID', task.id)
        .in('Task Name', subtaskTemplate)
        .eq('Progress', 'Completed');
      
      if (resetError) {
        console.error(`Error resetting subtasks for task ${task.id}:`, resetError);
      } else {
        totalSubtasksReset += resetCount || 0;
      }
      
      // Get existing subtasks for this task (after reset)
      const { data: existingSubtasks, error: subtasksError } = await supabaseClient
        .from('subtasks')
        .select('"Task Name"')
        .eq('Parent Task ID', task.id);
      
      if (subtasksError) {
        console.error(`Error fetching subtasks for task ${task.id}:`, subtasksError);
        continue;
      }
      
      const existingNames = (existingSubtasks || []).map(s => s['Task Name']);
      
      // Find subtasks that need to be added (were deleted during completion)
      const subtasksToAdd = subtaskTemplate
        .filter(name => name && name.trim() !== '' && !existingNames.includes(name))
        .map((name, index) => ({
          'Task Name': name.trim(),
          'Parent Task ID': task.id,
          'Progress': 'Not started',
          'user_id': task.user_id || settings.user_id,
          'sort_order': existingNames.length + index
        }));
      
      if (subtasksToAdd.length > 0) {
        const { error: insertError } = await supabaseClient
          .from('subtasks')
          .insert(subtasksToAdd);
        
        if (insertError) {
          console.error(`Error inserting subtasks for task ${task.id}:`, insertError);
        } else {
          totalSubtasksAdded += subtasksToAdd.length;
        }
      }
    }
    
    console.log(`Respawned subtasks for task list ${settings.task_list_id}: ${totalSubtasksReset} reset, ${totalSubtasksAdded} added`);
    
    // Update last_subtask_respawn
    await supabaseClient
      .from('recurring_task_settings')
      .update({ last_subtask_respawn: now.toISOString() })
      .eq('id', settings.id);
  }
}

// Get suppressed subtask names (completed since last respawn) for a task list
async function getSuppressedSubtaskNames(
  supabaseClient: any,
  taskListId: number,
  lastRespawn: string | null,
  subtaskTemplate: string[]
): Promise<string[]> {
  if (!subtaskTemplate || subtaskTemplate.length === 0) {
    return [];
  }
  
  const windowStart = lastRespawn ? new Date(lastRespawn) : new Date(0);
  
  // Find subtasks that were completed since the last respawn for this task list
  const { data: completedSubtasks, error } = await supabaseClient
    .from('subtasks')
    .select('"Task Name", "Parent Task ID", completed_at, Tasks!inner(task_list_id)')
    .eq('Tasks.task_list_id', taskListId)
    .in('Task Name', subtaskTemplate)
    .not('completed_at', 'is', null)
    .gte('completed_at', windowStart.toISOString());
  
  if (error) {
    console.error(`Error fetching suppressed subtasks for list ${taskListId}:`, error);
    return [];
  }
  
  // Get unique suppressed names
  const suppressedNames = [...new Set((completedSubtasks || []).map(s => s['Task Name']))];
  console.log(`Suppressed subtasks for list ${taskListId}: [${suppressedNames.join(', ')}]`);
  
  return suppressedNames;
}

// Enhanced count function that includes completed tasks for today (using 3 AM EST boundary)
const countAllTasksForDaily = async (supabaseClient: any, taskListId: number) => {
  try {
    // Use EST day boundaries (3 AM EST to 3 AM EST)
    const { dayStartUTC, dayEndUTC } = getESTDayBoundaries();
    
    // 1. Count active tasks in the list (Not Started or In Progress)
    // Active tasks with date_started >= 3 AM EST today
    const { data: activeTasks, error: activeError } = await supabaseClient
      .from('Tasks')
      .select('id')
      .eq('task_list_id', taskListId)
      .in('Progress', ['Not started', 'In progress'])
      .gte('date_started', dayStartUTC.toISOString());
      
    if (activeError) {
      console.error(`Error counting active tasks for list ${taskListId}:`, activeError);
      return { total: 0, active: 0, completedToday: 0 };
    }
    
    // 2. Count tasks completed today (using 3 AM EST boundary)
    const { data: completedTodayTasks, error: completedError } = await supabaseClient
      .from('Tasks')
      .select('id')
      .eq('task_list_id', taskListId)
      .eq('Progress', 'Completed')
      .gte('date_started', dayStartUTC.toISOString())
      .lt('date_started', dayEndUTC.toISOString());
    
    if (completedError) {
      console.error(`Error counting completed tasks for list ${taskListId}:`, completedError);
      return { total: 0, active: 0, completedToday: 0 };
    }
    
    // Calculate totals
    const activeCount = activeTasks?.length || 0;
    const completedTodayCount = completedTodayTasks?.length || 0;
    const totalCount = activeCount + completedTodayCount;
    
    console.log(`Task list ${taskListId} counts (3AM EST boundary): active=${activeCount}, completedToday=${completedTodayCount}, total=${totalCount}`);
    
    return { 
      total: totalCount,
      active: activeCount,
      completedToday: completedTodayCount
    };
  } catch (error) {
    console.error('Error in countAllTasksForDaily:', error);
    return { total: 0, active: 0, completedToday: 0 };
  }
};

// Get recurring projects in a task list that are scheduled to run today
async function getRecurringProjectsInList(
  supabaseClient: any,
  taskListId: number,
  currentDay: string
): Promise<{ projectId: number; recurringCount: number }[]> {
  try {
    // Get all recurring projects in this task list
    const { data: projects, error } = await supabaseClient
      .from('Projects')
      .select(`
        id,
        recurringTaskCount,
        isRecurring,
        recurring_project_settings(days_of_week)
      `)
      .eq('task_list_id', taskListId)
      .eq('isRecurring', true)
      .neq('progress', 'Completed');
    
    if (error) {
      console.error(`Error fetching recurring projects for list ${taskListId}:`, error);
      return [];
    }
    
    if (!projects || projects.length === 0) {
      return [];
    }
    
    const normalizedCurrentDay = normalizeDay(currentDay);
    
    // Filter to only projects scheduled for today
    const todayProjects = (projects || [])
      .filter(p => {
        // Get the project's recurring settings
        const settings = p.recurring_project_settings?.[0];
        
        // If no settings or no days_of_week, assume all days
        if (!settings?.days_of_week || !Array.isArray(settings.days_of_week) || settings.days_of_week.length === 0) {
          return true;
        }
        
        // Normalize project days and check if today is included
        const projectDays = settings.days_of_week.map(normalizeDay);
        return projectDays.includes(normalizedCurrentDay);
      })
      .map(p => ({
        projectId: p.id,
        recurringCount: p.recurringTaskCount || 1
      }));
    
    console.log(`Found ${todayProjects.length} recurring projects scheduled for today (${currentDay}) in list ${taskListId}`);
    
    return todayProjects;
  } catch (error) {
    console.error(`Error in getRecurringProjectsInList for list ${taskListId}:`, error);
    return [];
  }
}

// Validate toggle state and clean up orphaned enabled settings
async function validateAndCleanupToggleState(
  supabaseClient: any,
  taskListId: number,
  currentSettingId: number
): Promise<boolean> {
  try {
    // Check for multiple enabled settings for this list
    const { data: allEnabledSettings, error: fetchError } = await supabaseClient
      .from('recurring_task_settings')
      .select('id, created_at, enabled')
      .eq('task_list_id', taskListId)
      .eq('enabled', true)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error(`Error checking toggle state for list ${taskListId}:`, fetchError);
      return true; // Continue processing on error
    }
    
    if (!allEnabledSettings || allEnabledSettings.length <= 1) {
      // Normal state - 0 or 1 enabled setting
      return true;
    }
    
    // Multiple enabled settings found - this indicates a sync issue
    console.warn(`⚠️ TOGGLE STATE WARNING: Found ${allEnabledSettings.length} enabled settings for task list ${taskListId}`);
    console.warn(`Settings IDs: [${allEnabledSettings.map(s => s.id).join(', ')}]`);
    console.warn(`Current setting ID being used: ${currentSettingId}`);
    
    // Verify the current setting is the most recent one
    const mostRecentSettingId = allEnabledSettings[0].id;
    if (currentSettingId !== mostRecentSettingId) {
      console.warn(`⚠️ Current setting ${currentSettingId} is NOT the most recent! Most recent is ${mostRecentSettingId}`);
      console.warn(`Skipping task generation for this stale setting`);
      return false; // Don't process stale settings
    }
    
    // Disable orphaned settings (all except the most recent)
    const orphanedSettingIds = allEnabledSettings
      .slice(1)
      .map(s => s.id);
    
    if (orphanedSettingIds.length > 0) {
      console.log(`Cleaning up ${orphanedSettingIds.length} orphaned enabled settings: [${orphanedSettingIds.join(', ')}]`);
      
      const { error: cleanupError } = await supabaseClient
        .from('recurring_task_settings')
        .update({ enabled: false })
        .in('id', orphanedSettingIds);
      
      if (cleanupError) {
        console.error(`Error cleaning up orphaned settings:`, cleanupError);
      } else {
        console.log(`Successfully disabled orphaned settings for list ${taskListId}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Error in validateAndCleanupToggleState for list ${taskListId}:`, error);
    return true; // Continue processing on error
  }
}

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
    );

    // Check for subtask respawns first
    await checkSubtaskRespawns(supabaseClient);

    // Parse request body
    const body = await req.json();
    console.log("Received request body:", JSON.stringify(body));
    
    // Get EST day boundaries (day starts at 3 AM EST)
    const { estNow, estHour, dayStartUTC, dayEndUTC, estDayName } = getESTDayBoundaries();
    
    // Use these for database queries
    const today = dayStartUTC;
    const tomorrow = dayEndUTC;
    
    // Check if we're in the valid generation window (7 AM - 9 PM EST)
    const forceCheckFromBody = !!body.forceCheck;
    if (!forceCheckFromBody && (estHour < 7 || estHour >= 21)) {
      console.log(`Outside generation window (EST hour: ${estHour}), skipping task generation`);
      return new Response(
        JSON.stringify({ 
          message: 'Outside generation window', 
          estHour,
          windowStart: 7,
          windowEnd: 21
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Get current day of week - use EST time for consistency
    let dayOfWeek = body.currentDay;
    if (!dayOfWeek) {
      dayOfWeek = estDayName;
    }
    
    // Normalize the day name for consistent case-insensitive comparison
    const normalizedCurrentDay = normalizeDay(dayOfWeek);
    console.log(`Current day of week: ${dayOfWeek} (normalized: ${normalizedCurrentDay})`);

    // Handle different request scenarios
    let settings: RecurringTaskSetting[] = [];
    let specificListId: number | null = null;
    const forceCheck = !!body.forceCheck;
    const skipUniqueNameCheck = !!body.skipUniqueNameCheck;
    
    // When processing a specific list
    if (body.specificListId) {
      specificListId = body.specificListId;
      console.log(`Processing specific list ID: ${specificListId}`);
      
      // If this list is already being processed, skip to prevent duplicates
      if (processingLists.has(specificListId)) {
        console.log(`List ${specificListId} is already being processed, skipping`);
        return new Response(JSON.stringify({ 
          success: true, 
          results: [{ 
            task_list_id: specificListId, 
            status: 'skipped', 
            reason: 'concurrent_processing' 
          }]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      // Mark this list as being processed
      processingLists.add(specificListId);
      
      try {
        // Get only the most recent enabled setting for the specific task list
        // that includes today's day of week
        const { data: specificSettings, error: specificError } = await supabaseClient
          .from('recurring_task_settings')
          .select('*')
          .eq('enabled', true)
          .eq('task_list_id', specificListId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (specificError) {
          console.error('Error fetching specific task list settings:', specificError);
          throw specificError;
        }
        
        if (specificSettings && specificSettings.length > 0) {
          console.log(`Found settings for list ${specificListId}:`, specificSettings[0]);
          
          // Check and log days of week
          const settingDays = specificSettings[0].days_of_week || [];
          console.log(`List ${specificListId} configured days:`, settingDays);
          
          // Normalize all days in the setting for consistent comparison
          const normalizedSettingDays = settingDays.map(normalizeDay);
          console.log(`Normalized days for list ${specificListId}:`, normalizedSettingDays);
          
          // Check if today's day is in the normalized days array
          const dayMatches = normalizedSettingDays.includes(normalizedCurrentDay);
          console.log(`Day match check for list ${specificListId}: ${dayMatches} (${normalizedCurrentDay} in [${normalizedSettingDays.join(', ')}])`);
          
          // Double-check the days of week match (defensive) or force check
          if (dayMatches || forceCheck) {
            console.log(`Confirmed setting for list ${specificListId} includes today (${dayOfWeek}) or force check is enabled`);
            settings = specificSettings;
          } else {
            console.log(`Setting for list ${specificListId} does not include today (${dayOfWeek})`);
          }
        }
      } finally {
        // Ensure we remove the list from processing even if there's an error
        setTimeout(() => {
          processingLists.delete(specificListId);
        }, 5000);
      }
    } else if (body.settings && Array.isArray(body.settings)) {
      // If settings are provided in the request, use them
      settings = body.settings;
      
      // Log any day of week issues for debugging
      for (const setting of settings) {
        console.log(`Checking setting for list ${setting.task_list_id}:`);
        console.log(`  - days_of_week: ${JSON.stringify(setting.days_of_week)}`);
        
        // Normalize all days for this setting
        const normalizedSettingDays = (setting.days_of_week || []).map(normalizeDay);
        const settingIncludesToday = normalizedSettingDays.includes(normalizedCurrentDay);
        
        console.log(`  - normalized days: [${normalizedSettingDays.join(', ')}]`);
        console.log(`  - includes current day (${normalizedCurrentDay}): ${settingIncludesToday}`);
      }
      
      // Filter out settings that don't match today's day of week unless forcing
      if (!forceCheck) {
        const originalCount = settings.length;
        settings = settings.filter(s => {
          if (!s.days_of_week || !Array.isArray(s.days_of_week)) return false;
          
          // Use normalized comparison for consistency
          const normalizedSettingDays = s.days_of_week.map(normalizeDay);
          return normalizedSettingDays.includes(normalizedCurrentDay);
        });
        
        console.log(`Filtered settings from ${originalCount} to ${settings.length} based on day of week (${normalizedCurrentDay})`);
      }
      
      // Mark all lists as being processed
      for (const setting of settings) {
        if (setting.task_list_id && !processingLists.has(setting.task_list_id)) {
          processingLists.add(setting.task_list_id);
        }
      }
      
      // Ensure we remove the lists from processing
      setTimeout(() => {
        for (const setting of settings) {
          if (setting.task_list_id) {
            processingLists.delete(setting.task_list_id);
          }
        }
      }, 5000);
      
      console.log(`Using provided settings: ${settings.length} items`);
    } else {
      // Otherwise fetch all enabled settings for today's day of week
      console.log("Fetching all settings for today");
      const { data: allSettings, error: allSettingsError } = await supabaseClient
        .from('recurring_task_settings')
        .select('*')
        .eq('enabled', true);
      
      if (allSettingsError) {
        console.error('Error fetching all recurring task settings:', allSettingsError);
        throw allSettingsError;
      }
      
      if (allSettings) {
        // For each task list, only keep the most recent setting
        const latestSettingsByList = new Map<number, RecurringTaskSetting>();
        
        // Track lists with multiple enabled settings for validation
        const enabledSettingsByList = new Map<number, RecurringTaskSetting[]>();
        
        for (const setting of allSettings) {
          if (!setting.task_list_id) continue;
          
          // Track all enabled settings per list
          if (!enabledSettingsByList.has(setting.task_list_id)) {
            enabledSettingsByList.set(setting.task_list_id, []);
          }
          enabledSettingsByList.get(setting.task_list_id)!.push(setting);
          
          // Double-check days of week - stricter validation
          if (!setting.days_of_week || !Array.isArray(setting.days_of_week)) {
            console.log(`Skipping setting for list ${setting.task_list_id} - missing days of week`);
            continue;
          }
          
          // Normalize days for consistent comparison
          const normalizedSettingDays = setting.days_of_week.map(normalizeDay);
          const settingIncludesToday = normalizedSettingDays.includes(normalizedCurrentDay);
          
          if (!settingIncludesToday && !forceCheck) {
            console.log(`Skipping setting for list ${setting.task_list_id} - not configured for ${dayOfWeek}`);
            continue;
          }
          
          const existingSetting = latestSettingsByList.get(setting.task_list_id);
          
          if (!existingSetting || 
              !existingSetting.created_at ||
              !setting.created_at ||
              new Date(setting.created_at) > new Date(existingSetting.created_at)) {
            latestSettingsByList.set(setting.task_list_id, setting);
          }
        }
        
        // Log warnings for lists with multiple enabled settings (indicates sync issue)
        for (const [listId, listSettings] of enabledSettingsByList) {
          if (listSettings.length > 1) {
            console.warn(`⚠️ TOGGLE STATE WARNING: Found ${listSettings.length} enabled settings for task list ${listId}`);
            console.warn(`Settings IDs: [${listSettings.map(s => s.id).join(', ')}]`);
          }
        }
        
        settings = Array.from(latestSettingsByList.values());
        
        // Mark all lists as being processed
        for (const setting of settings) {
          if (setting.task_list_id && !processingLists.has(setting.task_list_id)) {
            processingLists.add(setting.task_list_id);
          }
        }
        
        // Ensure we remove the lists from processing
        setTimeout(() => {
          for (const setting of settings) {
            if (setting.task_list_id) {
              processingLists.delete(setting.task_list_id);
            }
          }
        }, 5000);
      }
    }
    
    console.log(`Processing ${settings.length} recurring task settings`);
    
    const results = [];

    for (const setting of settings) {
      try {
        if (!setting || !setting.task_list_id || !setting.enabled) {
          console.log('Skipping invalid setting', setting);
          results.push({ 
            task_list_id: setting?.task_list_id || null, 
            status: 'skipped', 
            reason: 'invalid_setting' 
          });
          continue;
        }
        
        // TOGGLE VALIDATION: Ensure this setting is valid and clean up orphans
        const isValidSetting = await validateAndCleanupToggleState(
          supabaseClient,
          setting.task_list_id,
          setting.id
        );
        
        if (!isValidSetting) {
          console.log(`Skipping stale setting ${setting.id} for list ${setting.task_list_id}`);
          results.push({
            task_list_id: setting.task_list_id,
            status: 'skipped',
            reason: 'stale_setting'
          });
          continue;
        }
        
        // Final check to verify the setting is for today's day of week
        if (!forceCheck && (!setting.days_of_week || !Array.isArray(setting.days_of_week))) {
          console.log(`Skipping setting for list ${setting.task_list_id} - missing day configuration`);
          results.push({
            task_list_id: setting.task_list_id,
            status: 'skipped',
            reason: 'missing_days_config'
          });
          continue;
        }
        
        if (!forceCheck) {
          // Normalize days of week for consistent comparison
          const normalizedSettingDays = setting.days_of_week.map(normalizeDay);
          const dayMatches = normalizedSettingDays.includes(normalizedCurrentDay);
          
          console.log(`Day match check for list ${setting.task_list_id}: ${dayMatches}`);
          console.log(`  - Setting days: [${setting.days_of_week.join(', ')}]`);
          console.log(`  - Normalized: [${normalizedSettingDays.join(', ')}]`);
          console.log(`  - Current day: ${dayOfWeek} (normalized: ${normalizedCurrentDay})`);
          
          if (!dayMatches) {
            console.log(`Skipping setting for list ${setting.task_list_id} - not configured for ${dayOfWeek}`);
            results.push({
              task_list_id: setting.task_list_id,
              status: 'skipped',
              reason: 'wrong_day',
              configured_days: setting.days_of_week,
              normalized_days: normalizedSettingDays,
              current_day: dayOfWeek,
              normalized_current_day: normalizedCurrentDay
            });
            continue;
          }
        }

        // Enhanced check for existing generation logs to prevent duplicates
        const { data: existingLogs, error: logsError } = await supabaseClient
          .from('recurring_task_generation_logs')
          .select('*')
          .eq('task_list_id', setting.task_list_id)
          .gte('generation_date', today.toISOString())
          .lt('generation_date', tomorrow.toISOString())
          .order('generation_date', { ascending: false });
          
        if (logsError) {
          console.error(`Error checking generation logs for list ${setting.task_list_id}:`, logsError);
        } else if (existingLogs && existingLogs.length > 0 && !forceCheck) {
          // If we already generated tasks for this list today, skip
          // Sum up tasks generated across all logs for this list today
          const totalTasksGenerated = existingLogs.reduce((sum, log) => sum + (log.tasks_generated || 0), 0);
          console.log(`Already generated ${totalTasksGenerated} tasks for list ${setting.task_list_id} today, skipping`);
          
          if (totalTasksGenerated >= setting.daily_task_count) {
            console.log(`Daily task goal of ${setting.daily_task_count} already met for list ${setting.task_list_id}, skipping`);
            results.push({ 
              task_list_id: setting.task_list_id, 
              status: 'skipped', 
              reason: 'already_generated',
              existing: totalTasksGenerated
            });
            continue;
          }
        }

        // Create a unique cache key for this generation attempt
        const cacheKey = `${setting.task_list_id}-${today.toISOString().split('T')[0]}`;
        if (generationCache.has(cacheKey) && !forceCheck) {
          console.log(`Already processed list ${setting.task_list_id} today (from cache), skipping`);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'already_generated_cache'
          });
          continue;
        }
        
        // Get the task list info for the task name and user_id
        const { data: taskList, error: taskListError } = await supabaseClient
          .from('TaskLists')
          .select('name, user_id')
          .eq('id', setting.task_list_id)
          .single();

        if (taskListError) {
          console.error(`Error fetching task list ${setting.task_list_id}:`, taskListError);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'error', 
            error: 'task_list_fetch_failed' 
          });
          continue;
        }

        // FULFILLMENT LOGIC: Get recurring projects scheduled for today and calculate expected tasks
        const recurringProjectsToday = await getRecurringProjectsInList(
          supabaseClient,
          setting.task_list_id,
          dayOfWeek
        );
        
        // Calculate total expected tasks from projects today
        const expectedProjectTasks = recurringProjectsToday.reduce(
          (sum, p) => sum + p.recurringCount, 
          0
        );
        
        console.log(`Expected tasks from projects in list ${setting.task_list_id} for today: ${expectedProjectTasks}`);
        
        // If projects alone will fulfill the list's daily goal, skip list-level task generation
        if (expectedProjectTasks >= setting.daily_task_count && !forceCheck) {
          console.log(`✅ FULFILLMENT: Projects in list ${setting.task_list_id} will generate ${expectedProjectTasks} tasks, meeting/exceeding list goal of ${setting.daily_task_count}. Skipping list-level generation.`);
          
          // Add to cache to prevent duplicate processing
          generationCache.set(cacheKey, true);
          
          results.push({
            task_list_id: setting.task_list_id,
            status: 'skipped',
            reason: 'fulfilled_by_projects',
            expected_project_tasks: expectedProjectTasks,
            list_goal: setting.daily_task_count
          });
          continue;
        }

        // Get all recurring projects associated with this task list (for direct task creation)
        const { data: taskListProjects, error: projectsError } = await supabaseClient
          .from('Projects')
          .select('id, "Project Name", isRecurring, recurringTaskCount, task_list_id, user_id')
          .eq('task_list_id', setting.task_list_id)
          .eq('isRecurring', true)
          .neq('progress', 'Completed');
          
        if (projectsError) {
          console.error(`Error fetching recurring projects for task list ${setting.task_list_id}:`, projectsError);
        }
        
        const recurringProjects = taskListProjects || [];
        console.log(`Found ${recurringProjects.length} recurring projects in task list ${setting.task_list_id}`);
        
        // CRITICAL FIX: Count BOTH active and completed tasks for today
        const taskCounts = await countAllTasksForDaily(supabaseClient, setting.task_list_id);
        console.log(`List ${setting.task_list_id} has ${taskCounts.total} total relevant tasks (${taskCounts.active} active, ${taskCounts.completedToday} completed today)`);
        
        // If we already have enough tasks (active + completed today) for the day, skip
        if ((taskCounts.total >= setting.daily_task_count) && !forceCheck) {
          console.log(`Already have enough tasks for list ${setting.task_list_id}, skipping`);
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'enough_tasks', 
            existing: taskCounts.total,
            active: taskCounts.active,
            completed_today: taskCounts.completedToday
          });
          
          // Update generation log to reflect that we already have enough tasks
          await updateGenerationLog(supabaseClient, setting.task_list_id, setting.id, taskCounts.total, taskList?.user_id);
          
          // Add to cache
          generationCache.set(cacheKey, true);
          
          continue;
        }

        const listName = taskList?.name || `List ${setting.task_list_id}`;
        const tasksToCreate = [];
        
        // First, check existing active tasks for each recurring project to meet their individual goals
        let projectTasksNeeded = 0;
        let projectTasksCreated = 0;
        
        for (const project of recurringProjects) {
          if (!project.id || !project.recurringTaskCount) continue;
          
          // Count active tasks for this project
          const { data: activeProjectTasks, error: projectTasksError } = await supabaseClient
            .from('Tasks')
            .select('id, "Task Name"')
            .eq('project_id', project.id)
            .in('Progress', ['Not started', 'In progress']);
            
          if (projectTasksError) {
            console.error(`Error counting active tasks for project ${project.id}:`, projectTasksError);
            continue;
          }
          
          // Count tasks completed today for this project
          const { data: completedTodayProjectTasks, error: completedProjectError } = await supabaseClient
            .from('Tasks')
            .select('id')
            .eq('project_id', project.id)
            .eq('Progress', 'Completed')
            .gte('date_completed', today.toISOString())
            .lt('date_completed', tomorrow.toISOString());
            
          if (completedProjectError) {
            console.error(`Error counting completed tasks for project ${project.id}:`, completedProjectError);
            continue;
          }
          
          const activeProjectTaskCount = activeProjectTasks?.length || 0;
          const completedTodayProjectTaskCount = completedTodayProjectTasks?.length || 0;
          const totalProjectTaskCount = activeProjectTaskCount + completedTodayProjectTaskCount;
          
          const projectTaskGoal = project.recurringTaskCount || 1;
          console.log(`Project ${project.id} (${project["Project Name"]}) has ${activeProjectTaskCount} active tasks and ${completedTodayProjectTaskCount} completed today, out of goal ${projectTaskGoal}`);
          
          // If the project already has enough total tasks for today, skip it
          if (totalProjectTaskCount >= projectTaskGoal && !forceCheck) {
            console.log(`Project ${project.id} already has enough tasks for today (${totalProjectTaskCount}/${projectTaskGoal}), skipping`);
            continue;
          }
          
          const projectTasksToCreate = Math.max(0, projectTaskGoal - totalProjectTaskCount);
          projectTasksNeeded += projectTasksToCreate;
          
          console.log(`Creating ${projectTasksToCreate} new tasks for project ${project.id} (${project["Project Name"]})`);
          
          // Get existing task names for this project - only if we're not skipping unique name check
          const existingProjectTaskNames = !skipUniqueNameCheck && activeProjectTasks 
            ? activeProjectTasks.map(t => t["Task Name"]) 
            : [];
          
          for (let i = 0; i < projectTasksToCreate; i++) {
            // Always start tasks at 1pm UTC (9am EST) - consistent time
            const taskStartTime = new Date(today);
            taskStartTime.setHours(13, 0 + (i * 30), 0, 0); // Changed from 9 to 13 for EST (9am EST = 1pm UTC)
            
            const taskEndTime = new Date(taskStartTime);
            taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25 min duration
            
            let taskNumber = totalProjectTaskCount + i + 1;
            let taskName = `${project["Project Name"]} - Task ${taskNumber}`;
            
            // Only do uniqueness check if not skipping it
            if (!skipUniqueNameCheck) {
              // Ensure we don't create duplicate task names
              let uniqueNameCounter = 1;
              while (existingProjectTaskNames.includes(taskName)) {
                taskName = `${project["Project Name"]} - Task ${taskNumber} (${uniqueNameCounter})`;
                uniqueNameCounter++;
              }
              
              // Add the task name to our tracking array to prevent duplicates in this batch
              existingProjectTaskNames.push(taskName);
            }
              
            tasksToCreate.push({
              "Task Name": taskName,
              Progress: "Not started",
              date_started: taskStartTime.toISOString(),
              date_due: taskEndTime.toISOString(),
              task_list_id: setting.task_list_id,
              project_id: project.id,
              user_id: project.user_id  // Add user_id to comply with RLS policy
            });
            
            projectTasksCreated++;
          }
        }
        
        // Get tasks not associated with recurring projects
        const { data: nonProjectTasks, error: nonProjectError } = await supabaseClient
          .from('Tasks')
          .select('id, "Task Name"')
          .eq('task_list_id', setting.task_list_id)
          .is('project_id', null)
          .in('Progress', ['Not started', 'In progress']);
          
        if (nonProjectError) {
          console.error(`Error fetching non-project tasks for list ${setting.task_list_id}:`, nonProjectError);
        }
        
        // Count tasks completed today not associated with any project
        const { data: completedTodayNonProjectTasks, error: completedNonProjectError } = await supabaseClient
          .from('Tasks')
          .select('id')
          .eq('task_list_id', setting.task_list_id)
          .is('project_id', null)
          .eq('Progress', 'Completed')
          .gte('date_completed', today.toISOString())
          .lt('date_completed', tomorrow.toISOString());
          
        if (completedNonProjectError) {
          console.error(`Error counting completed non-project tasks for list ${setting.task_list_id}:`, completedNonProjectError);
        }
        
        // Calculate how many direct list tasks we need
        const nonProjectActiveCount = nonProjectTasks?.length || 0;
        const nonProjectCompletedCount = completedTodayNonProjectTasks?.length || 0;
        const totalNonProjectCount = nonProjectActiveCount + nonProjectCompletedCount;
        
        console.log(`List ${setting.task_list_id} has ${nonProjectActiveCount} active non-project tasks and ${nonProjectCompletedCount} completed today`);
        
        // FULFILLMENT LOGIC: Account for expected project tasks when calculating list tasks needed
        // Only create enough list-level tasks to fill the gap between what projects will provide and the list goal
        const effectiveExistingTasks = taskCounts.total + expectedProjectTasks;
        const additionalListTasksToCreate = Math.max(0, setting.daily_task_count - effectiveExistingTasks - projectTasksCreated);
        
        console.log(`List ${setting.task_list_id} needs ${additionalListTasksToCreate} more direct tasks (existing: ${taskCounts.total}, expected from projects: ${expectedProjectTasks}, goal: ${setting.daily_task_count})`);
        
        // Create remaining tasks directly for the task list (not assigned to any project)
        if (additionalListTasksToCreate > 0) {
          // Check for existing task names to avoid duplicates - only if not skipping name check
          const existingTaskNames = !skipUniqueNameCheck && nonProjectTasks 
            ? nonProjectTasks.map(task => task["Task Name"])
            : [];
          
          for (let i = 0; i < additionalListTasksToCreate; i++) {
            // Always start tasks at 1pm UTC (9am EST) - consistent time
            const taskStartTime = new Date(today);
            taskStartTime.setHours(13, 0 + ((projectTasksCreated + i) * 30), 0, 0); // Changed from 9 to 13 for EST (9am EST = 1pm UTC)
            
            const taskEndTime = new Date(taskStartTime);
            taskEndTime.setMinutes(taskStartTime.getMinutes() + 25); // 25 min duration
            
            // Ensure we don't create duplicate task names
            let taskNumber = totalNonProjectCount + i + 1;
            let taskName = `${listName} - Task ${taskNumber}`;
            
            // Only do uniqueness check if not skipping it
            if (!skipUniqueNameCheck) {
              // Ensure we don't create duplicate task names
              let uniqueNameCounter = 1;
              while (existingTaskNames.includes(taskName)) {
                taskName = `${listName} - Task ${taskNumber} (${uniqueNameCounter})`;
                uniqueNameCounter++;
              }
              
              // Add the task name to our tracking array to prevent duplicates in this batch
              existingTaskNames.push(taskName);
            }
              
            tasksToCreate.push({
              "Task Name": taskName,
              Progress: "Not started",
              date_started: taskStartTime.toISOString(),
              date_due: taskEndTime.toISOString(),
              task_list_id: setting.task_list_id,
              project_id: null, // Not associated with any project
              user_id: taskList?.user_id  // Add user_id to comply with RLS policy
            });
          }
        }

        if (tasksToCreate.length > 0) {
          const { data: newTasks, error: createError } = await supabaseClient
            .from('Tasks')
            .insert(tasksToCreate)
            .select();

          if (createError) {
            console.error(`Error creating tasks for list ${setting.task_list_id}:`, createError);
            results.push({ 
              task_list_id: setting.task_list_id, 
              status: 'error', 
              error: 'task_creation_failed' 
            });
            continue;
          }

          console.log(`Successfully created ${newTasks?.length || 0} tasks for list ${setting.task_list_id} (${projectTasksCreated} for projects, ${additionalListTasksToCreate} for the list itself)`);
          
          // Create subtasks for each new task if subtask_names are configured
          // But exclude suppressed subtasks (completed since last respawn)
          if (newTasks && newTasks.length > 0 && setting.subtask_names && setting.subtask_names.length > 0) {
            const recurringModes = ['daily', 'every_x_days', 'every_x_weeks', 'days_of_week'];
            let subtasksToInsertNames = [...setting.subtask_names];
            
            // For recurring modes, check for suppressed subtasks
            if (recurringModes.includes(setting.subtask_mode || '')) {
              const suppressedNames = await getSuppressedSubtaskNames(
                supabaseClient,
                setting.task_list_id,
                setting.last_subtask_respawn,
                setting.subtask_names
              );
              
              // Filter out suppressed subtasks
              subtasksToInsertNames = subtasksToInsertNames.filter(
                name => !suppressedNames.includes(name)
              );
              
              console.log(`After filtering suppressed subtasks, inserting: [${subtasksToInsertNames.join(', ')}]`);
            }
            
            const subtasksToInsert = [];
            
            for (const newTask of newTasks) {
              for (const subtaskName of subtasksToInsertNames) {
                if (subtaskName && subtaskName.trim() !== '') {
                  subtasksToInsert.push({
                    "Task Name": subtaskName.trim(),
                    "Progress": "Not started",
                    "Parent Task ID": newTask.id,
                    "user_id": newTask.user_id
                  });
                }
              }
            }
            
            if (subtasksToInsert.length > 0) {
              const { error: subtaskError } = await supabaseClient
                .from('subtasks')
                .insert(subtasksToInsert);
                
              if (subtaskError) {
                console.error(`Error creating subtasks for list ${setting.task_list_id}:`, subtaskError);
              } else {
                console.log(`Successfully created ${subtasksToInsert.length} subtasks for ${newTasks.length} tasks in list ${setting.task_list_id}`);
              }
            }
          }
          
          // Record the successful generation
          const totalTasksGenerated = (existingLogs?.[0]?.tasks_generated || 0) + (newTasks?.length || 0);
          await updateGenerationLog(
            supabaseClient, 
            setting.task_list_id, 
            setting.id, 
            totalTasksGenerated,
            taskList?.user_id
          );
          
          // Add to cache to prevent duplicate processing
          generationCache.set(cacheKey, true);
          
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'created', 
            tasksCreated: newTasks?.length || 0,
            for_projects: projectTasksCreated,
            for_list: additionalListTasksToCreate 
          });
        } else {
          results.push({ 
            task_list_id: setting.task_list_id, 
            status: 'skipped', 
            reason: 'no_tasks_needed' 
          });
        }
      } catch (settingError) {
        console.error(`Error processing setting for list ${setting?.task_list_id}:`, settingError);
        results.push({
          task_list_id: setting?.task_list_id,
          status: 'error',
          error: settingError.message
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    
  } catch (error) {
    console.error('Error checking recurring tasks:', error);
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
