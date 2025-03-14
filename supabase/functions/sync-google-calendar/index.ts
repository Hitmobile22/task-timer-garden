
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Environment variables
const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
)

// Converts a task to a Google Calendar event
function taskToGoogleEvent(task) {
  const startDateTime = task.date_started || task.created_at;
  const endDateTime = task.date_due || new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString(); // Default 1 hour duration

  // Set color based on task status
  // Color IDs: https://developers.google.com/calendar/api/v3/reference/colors/get
  // 1: Blue (In Progress), 2: Green (Completed), 10: Red (Not Started), 8: Gray (Backlog)
  let colorId;
  switch(task.Progress) {
    case 'In progress': colorId = '1'; break;
    case 'Not started': colorId = '10'; break;
    case 'Completed': colorId = '2'; break;
    case 'Backlog': colorId = '8'; break;
    default: colorId = '0'; // Default
  }

  return {
    summary: task["Task Name"],
    description: task.details ? JSON.stringify(task.details) : '',
    start: {
      dateTime: new Date(startDateTime).toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: new Date(endDateTime).toISOString(),
      timeZone: 'UTC',
    },
    colorId: colorId,
    transparency: task.Progress === 'Completed' ? 'transparent' : 'opaque',
  };
}

// Refreshes the Google access token
async function refreshAccessToken() {
  const { data, error } = await supabase
    .from('google_calendar_settings')
    .select('refresh_token, calendar_id')
    .eq('id', 'shared-calendar-settings')
    .maybeSingle();
  
  if (error || !data?.refresh_token) {
    console.error('Failed to get refresh token:', error);
    throw error || new Error('No refresh token found');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token refresh failed:', errorText);
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await response.json();
  return { access_token: tokenData.access_token, calendar_id: data.calendar_id };
}

// Main function to sync tasks to Google Calendar
async function syncTasksToGoogleCalendar() {
  try {
    console.log('Starting Google Calendar sync');
    
    // Get the access token
    const { access_token, calendar_id } = await refreshAccessToken();
    
    // Get all tasks that are not completed or in backlog
    const { data: tasks, error } = await supabase
      .from('Tasks')
      .select('*, project_id, task_list_id')
      .in('Progress', ['Not started', 'In progress']);
    
    if (error || !tasks || tasks.length === 0) {
      console.log('No tasks found to sync');
      throw error || new Error('No tasks found');
    }

    // Use the primary calendar if no specific calendar ID is set
    const targetCalendarId = calendar_id || 'primary';

    // For each task, create or update the corresponding Google Calendar event
    for (const task of tasks) {
      const event = taskToGoogleEvent(task);
      
      // Check if we already have a synced event for this task
      const { data: syncedEvent, error: syncedEventError } = await supabase
        .from('synced_calendar_events')
        .select('google_event_id')
        .eq('task_id', task.id)
        .maybeSingle();
      
      const calendarEndpoint = `https://www.googleapis.com/calendar/v3/calendars/${targetCalendarId}/events`;
      
      if (syncedEvent?.google_event_id) {
        // Update existing event
        const updateResponse = await fetch(`${calendarEndpoint}/${syncedEvent.google_event_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        
        if (!updateResponse.ok) {
          console.error(`Failed to update event for task ${task.id}:`, await updateResponse.text());
          continue;
        }
        
        console.log(`Updated Google Calendar event for task: ${task["Task Name"]}`);
      } else {
        // Create new event
        const createResponse = await fetch(calendarEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        
        if (!createResponse.ok) {
          console.error(`Failed to create event for task ${task.id}:`, await createResponse.text());
          continue;
        }
        
        const createdEvent = await createResponse.json();
        
        // Store the mapping between task and Google Calendar event
        await supabase
          .from('synced_calendar_events')
          .upsert({
            task_id: task.id,
            google_event_id: createdEvent.id,
            last_sync_time: new Date().toISOString(),
          });
        
        console.log(`Created Google Calendar event for task: ${task["Task Name"]}`);
      }
    }
    
    // Update last sync time
    await supabase
      .from('google_calendar_settings')
      .update({ last_sync_time: new Date().toISOString() })
      .eq('id', 'shared-calendar-settings');
    
    return { success: true, message: `Synced ${tasks.length} tasks to Google Calendar` };
  } catch (error) {
    console.error('Error syncing tasks to Google Calendar:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const result = await syncTasksToGoogleCalendar();
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in sync-google-calendar function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
