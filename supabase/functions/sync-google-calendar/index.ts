
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
  console.log("Refreshing Google access token...");
  const { data, error } = await supabase
    .from('google_calendar_settings')
    .select('refresh_token, calendar_id')
    .eq('id', 'shared-calendar-settings')
    .maybeSingle();
  
  if (error || !data?.refresh_token) {
    console.error('Failed to get refresh token:', error || "No refresh token found");
    throw error || new Error('No refresh token found');
  }

  console.log("Refresh token found, exchanging for access token");
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
  console.log("Access token obtained successfully");
  return { access_token: tokenData.access_token, calendar_id: data.calendar_id };
}

// Get all previously synced events from Google Calendar
async function getAllCalendarEvents(calendarId, accessToken) {
  try {
    console.log(`Getting events from calendar: ${calendarId}`);
    const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get calendar events: ${await response.text()}`);
    }

    const data = await response.json();
    console.log(`Retrieved ${data.items?.length || 0} events from Google Calendar`);
    return data.items || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

// Delete all events created by this app
async function deleteAllSyncedEvents(calendarId, accessToken) {
  try {
    console.log("Starting deletion of previously synced events");
    // Get all events we've previously synced
    const { data: syncedEvents } = await supabase
      .from('synced_calendar_events')
      .select('google_event_id');
    
    if (!syncedEvents || syncedEvents.length === 0) {
      console.log('No previously synced events to delete');
      return;
    }

    console.log(`Deleting ${syncedEvents.length} previously synced events`);
    
    // Delete each event from Google Calendar
    for (const event of syncedEvents) {
      try {
        const deleteEndpoint = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${event.google_event_id}`;
        
        const deleteResponse = await fetch(deleteEndpoint, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (!deleteResponse.ok && deleteResponse.status !== 410) {
          // 410 Gone is ok - means event was already deleted
          console.warn(`Failed to delete event ${event.google_event_id}: ${await deleteResponse.text()}`);
        }
      } catch (err) {
        console.warn(`Error deleting event ${event.google_event_id}:`, err);
        // Continue with other deletions even if one fails
      }
    }
    
    // Clear the synced_calendar_events table
    const { error: deleteError } = await supabase
      .from('synced_calendar_events')
      .delete()
      .neq('id', 'placeholder');
    
    if (deleteError) {
      console.error("Error clearing synced_calendar_events table:", deleteError);
    } else {
      console.log('All synced events deleted and database cleared');
    }
  } catch (error) {
    console.error('Error in deleteAllSyncedEvents:', error);
    throw error;
  }
}

// Main function to sync tasks to Google Calendar
async function syncTasksToGoogleCalendar() {
  try {
    console.log('Starting Google Calendar sync with clear-and-resync approach');
    
    // Get the access token
    const { access_token, calendar_id } = await refreshAccessToken();
    
    // Use the primary calendar if no specific calendar ID is set
    const targetCalendarId = calendar_id || 'primary';
    console.log(`Using calendar ID: ${targetCalendarId}`);
    
    // Step 1: Delete all previously synced events
    await deleteAllSyncedEvents(targetCalendarId, access_token);
    
    // Step 2: Get all tasks that are not completed or in backlog
    const { data: tasks, error } = await supabase
      .from('Tasks')
      .select('*, project_id, task_list_id')
      .in('Progress', ['Not started', 'In progress']);
    
    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
    
    if (!tasks || tasks.length === 0) {
      console.log('No active tasks found to sync');
      return { success: true, message: 'No active tasks to sync' };
    }
    
    console.log(`Found ${tasks.length} active tasks to sync to Google Calendar`);
    
    // Step 3: Create new events for all active tasks
    const calendarEndpoint = `https://www.googleapis.com/calendar/v3/calendars/${targetCalendarId}/events`;
    const syncedEvents = [];
    
    for (const task of tasks) {
      try {
        if (!task.date_started || !task.date_due) {
          console.log(`Skipping task ${task.id} (${task["Task Name"]}) - missing start or due date`);
          continue;
        }
        
        const event = taskToGoogleEvent(task);
        console.log(`Creating event for task: ${task["Task Name"]}`);
        
        const createResponse = await fetch(calendarEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        });
        
        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error(`Failed to create event for task ${task.id}:`, errorText);
          continue;
        }
        
        const createdEvent = await createResponse.json();
        console.log(`Successfully created event with ID: ${createdEvent.id}`);
        
        // Store the mapping between task and Google Calendar event
        const { error: insertError } = await supabase
          .from('synced_calendar_events')
          .insert({
            task_id: task.id,
            google_event_id: createdEvent.id,
            last_sync_time: new Date().toISOString(),
          });
        
        if (insertError) {
          console.error(`Failed to store mapping for task ${task.id}:`, insertError);
        } else {
          syncedEvents.push({
            taskId: task.id,
            taskName: task["Task Name"],
            eventId: createdEvent.id
          });
        }
      } catch (err) {
        console.error(`Error processing task ${task.id}:`, err);
      }
    }
    
    // Update last sync time
    const { error: updateError } = await supabase
      .from('google_calendar_settings')
      .update({ last_sync_time: new Date().toISOString() })
      .eq('id', 'shared-calendar-settings');
      
    if (updateError) {
      console.error("Error updating last sync time:", updateError);
    }
    
    console.log(`Successfully synced ${syncedEvents.length} tasks to Google Calendar`);
    
    return { 
      success: true, 
      message: `Synced ${syncedEvents.length} tasks to Google Calendar`,
      syncedEvents
    };
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
    console.log("Google Calendar sync edge function invoked");
    const result = await syncTasksToGoogleCalendar();
    console.log("Sync completed with result:", result);
    
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
