
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
)

// Convert a task to a Google Calendar event
function taskToGoogleEvent(task: any) {
  // Format task dates for Google Calendar
  const startDateTime = new Date(task.date_started).toISOString();
  const endDateTime = new Date(task.date_due).toISOString();
  
  // Create event with the task data
  return {
    summary: task['Task Name'],
    description: `Task Status: ${task.Progress}`,
    start: {
      dateTime: startDateTime,
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'UTC',
    },
    colorId: task.Progress === 'In progress' ? '5' : '1', // Blue for in-progress, Red for not started
  };
}

async function getRefreshToken() {
  const { data, error } = await supabase
    .from('google_calendar_settings')
    .select('refresh_token, calendar_id')
    .eq('user_id', 'shared-calendar')
    .single();
  
  if (error || !data?.refresh_token) {
    throw new Error('No refresh token found');
  }
  
  return { refreshToken: data.refresh_token, calendarId: data.calendar_id };
}

async function refreshAccessToken(refreshToken: string) {
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function syncTasks() {
  try {
    // Get the refresh token
    const { refreshToken, calendarId } = await getRefreshToken();
    
    // Get a fresh access token
    const accessToken = await refreshAccessToken(refreshToken);
    
    // Fetch tasks that are not completed or in the backlog
    const { data: tasks, error } = await supabase
      .from('Tasks')
      .select('*')
      .in('Progress', ['Not started', 'In progress'])
      .not('date_started', 'is', null)
      .not('date_due', 'is', null);
    
    if (error || !tasks) {
      throw error || new Error('No tasks found');
    }

    // For each task, create or update the corresponding Google Calendar event
    for (const task of tasks) {
      const event = taskToGoogleEvent(task);
      
      // Check if we already have a synced event for this task
      const { data: syncedEvent } = await supabase
        .from('synced_calendar_events')
        .select('google_event_id')
        .eq('task_id', task.id)
        .single();
      
      const calendarEndpoint = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
      
      if (syncedEvent?.google_event_id) {
        // Update existing event
        await fetch(`${calendarEndpoint}/${syncedEvent.google_event_id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
      } else {
        // Create new event
        const response = await fetch(calendarEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        
        if (response.ok) {
          const eventData = await response.json();
          // Store the mapping between task and Google Calendar event
          await supabase
            .from('synced_calendar_events')
            .insert({
              task_id: task.id,
              google_event_id: eventData.id,
            });
        }
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Sync error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await syncTasks();
    return new Response(
      JSON.stringify({ message: 'Calendar sync completed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
