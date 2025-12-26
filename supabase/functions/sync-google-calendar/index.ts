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

// Converts a task to a Google Calendar event (timed event)
function taskToGoogleEvent(task: any) {
  const startDateTime = task.date_started || task.created_at;
  const endDateTime = task.date_due || new Date(new Date(startDateTime).getTime() + 60 * 60 * 1000).toISOString();

  // Color IDs: https://developers.google.com/calendar/api/v3/reference/colors/get
  // 1: Blue (In Progress), 2: Green (Completed), 10: Red (Not Started), 8: Gray (Backlog)
  let colorId;
  switch(task.Progress) {
    case 'In progress': colorId = '1'; break;
    case 'Not started': colorId = '10'; break;
    case 'Completed': colorId = '2'; break;
    case 'Backlog': colorId = '8'; break;
    default: colorId = '0';
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

// Converts a project to a Google Calendar all-day event
function projectToGoogleEvent(project: any) {
  // Extract just the date part (YYYY-MM-DD) for all-day events
  const dueDate = new Date(project.date_due);
  const dueDateStr = dueDate.toISOString().split('T')[0];
  
  // For all-day events, end date is exclusive (must be next day)
  const endDate = new Date(dueDate);
  endDate.setDate(endDate.getDate() + 1);
  const endDateStr = endDate.toISOString().split('T')[0];

  // Color based on project status
  // 3: Purple/Grape for projects, 2: Green (Completed), 6: Orange (Not Started)
  let colorId;
  switch(project.progress) {
    case 'In progress': colorId = '3'; break; // Purple/Grape
    case 'Not started': colorId = '6'; break; // Orange
    case 'Completed': colorId = '2'; break; // Green
    default: colorId = '5'; // Yellow
  }

  return {
    summary: `📁 ${project["Project Name"]} - Due`,
    description: `Project due date`,
    start: {
      date: dueDateStr, // All-day format (no time component)
    },
    end: {
      date: endDateStr, // All-day format (exclusive end date)
    },
    colorId: colorId,
    transparency: 'opaque',
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
  
  if (error) {
    console.error('Failed to get refresh token:', error);
    throw error;
  }
  
  if (!data?.refresh_token) {
    console.error('No refresh token found');
    throw new Error('No refresh token found. Please connect Google Calendar first.');
  }

  console.log("Refresh token found, exchanging for access token");
  try {
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
      
      if (response.status === 400 || response.status === 401) {
        console.log("Invalid refresh token, clearing from database");
        await supabase
          .from('google_calendar_settings')
          .update({ refresh_token: null, sync_enabled: false })
          .eq('id', 'shared-calendar-settings');
          
        throw new Error('Invalid refresh token. Please reconnect Google Calendar.');
      }
      
      throw new Error(`Failed to refresh token: ${errorText}`);
    }

    const tokenData = await response.json();
    console.log("Access token obtained successfully");
    return { access_token: tokenData.access_token, calendar_id: data.calendar_id };
  } catch (err) {
    console.error("Error refreshing access token:", err);
    throw err;
  }
}

// Delete all events created by this app
async function deleteAllSyncedEvents(calendarId: string, accessToken: string) {
  try {
    console.log("Starting deletion of previously synced events");
    const { data: syncedEvents } = await supabase
      .from('synced_calendar_events')
      .select('google_event_id');
    
    if (!syncedEvents || syncedEvents.length === 0) {
      console.log('No previously synced events to delete');
      return;
    }

    console.log(`Deleting ${syncedEvents.length} previously synced events`);
    
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
          console.warn(`Failed to delete event ${event.google_event_id}: ${await deleteResponse.text()}`);
        }
      } catch (err) {
        console.warn(`Error deleting event ${event.google_event_id}:`, err);
      }
    }
    
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

// Main function to sync tasks and projects to Google Calendar
async function syncToGoogleCalendar() {
  try {
    console.log('Starting Google Calendar sync with clear-and-resync approach');
    
    const { access_token, calendar_id } = await refreshAccessToken();
    const targetCalendarId = calendar_id || 'primary';
    console.log(`Using calendar ID: ${targetCalendarId}`);
    
    // Step 1: Delete all previously synced events
    await deleteAllSyncedEvents(targetCalendarId, access_token);
    
    const calendarEndpoint = `https://www.googleapis.com/calendar/v3/calendars/${targetCalendarId}/events`;
    const syncedEvents: any[] = [];
    
    // Step 2: Sync Tasks (as timed events)
    const { data: tasks, error: tasksError } = await supabase
      .from('Tasks')
      .select('*, project_id, task_list_id')
      .in('Progress', ['Not started', 'In progress'])
      .eq('archived', false);
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
    } else if (tasks && tasks.length > 0) {
      console.log(`Found ${tasks.length} active tasks to sync`);
      
      for (const task of tasks) {
        try {
          if (!task.date_started || !task.date_due) {
            console.log(`Skipping task ${task.id} (${task["Task Name"]}) - missing dates`);
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
          console.log(`Created task event with ID: ${createdEvent.id}`);
          
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
              type: 'task',
              id: task.id,
              name: task["Task Name"],
              eventId: createdEvent.id
            });
          }
        } catch (err) {
          console.error(`Error processing task ${task.id}:`, err);
        }
      }
    } else {
      console.log('No active tasks found to sync');
    }
    
    // Step 3: Sync Projects with due dates (as all-day events)
    const { data: projects, error: projectsError } = await supabase
      .from('Projects')
      .select('*')
      .not('date_due', 'is', null)
      .eq('archived', false)
      .in('progress', ['Not started', 'In progress']);
    
    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
    } else if (projects && projects.length > 0) {
      console.log(`Found ${projects.length} projects with due dates to sync`);
      
      for (const project of projects) {
        try {
          const event = projectToGoogleEvent(project);
          console.log(`Creating all-day event for project: ${project["Project Name"]}`);
          
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
            console.error(`Failed to create event for project ${project.id}:`, errorText);
            continue;
          }
          
          const createdEvent = await createResponse.json();
          console.log(`Created project all-day event with ID: ${createdEvent.id}`);
          
          const { error: insertError } = await supabase
            .from('synced_calendar_events')
            .insert({
              project_id: project.id,
              google_event_id: createdEvent.id,
              last_sync_time: new Date().toISOString(),
            });
          
          if (insertError) {
            console.error(`Failed to store mapping for project ${project.id}:`, insertError);
          } else {
            syncedEvents.push({
              type: 'project',
              id: project.id,
              name: project["Project Name"],
              eventId: createdEvent.id
            });
          }
        } catch (err) {
          console.error(`Error processing project ${project.id}:`, err);
        }
      }
    } else {
      console.log('No projects with due dates found to sync');
    }
    
    // Update last sync time
    const { error: updateError } = await supabase
      .from('google_calendar_settings')
      .update({ last_sync_time: new Date().toISOString() })
      .eq('id', 'shared-calendar-settings');
      
    if (updateError) {
      console.error("Error updating last sync time:", updateError);
    }
    
    const taskCount = syncedEvents.filter(e => e.type === 'task').length;
    const projectCount = syncedEvents.filter(e => e.type === 'project').length;
    
    console.log(`Successfully synced ${taskCount} tasks and ${projectCount} projects to Google Calendar`);
    
    return { 
      success: true, 
      message: `Synced ${taskCount} tasks and ${projectCount} project due dates to Google Calendar`,
      syncedEvents
    };
  } catch (error: any) {
    console.error('Error syncing to Google Calendar:', error);
    return { success: false, error: error.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log("Google Calendar sync edge function invoked");
    const result = await syncToGoogleCalendar();
    console.log("Sync completed with result:", result);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
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
