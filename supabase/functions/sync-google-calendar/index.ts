
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!
)

async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
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
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to refresh token: ${errorText}`)
  }

  const data = await response.json()
  return data.access_token
}

async function syncTasks() {
  // Get Google Calendar settings
  const { data: settings, error: settingsError } = await supabase
    .from('google_calendar_settings')
    .select('*')
    .eq('sync_enabled', true)
    .single()

  if (settingsError || !settings?.refresh_token) {
    throw new Error('Google Calendar not connected or sync not enabled')
  }

  // Get active tasks (Not started or In progress) with dates
  const { data: tasks, error: tasksError } = await supabase
    .from('Tasks')
    .select('*')
    .in('Progress', ['Not started', 'In progress'])
    .not('date_started', 'is', null)
    .not('date_due', 'is', null)

  if (tasksError) {
    throw new Error(`Failed to get tasks: ${tasksError.message}`)
  }

  // Get existing synced events
  const { data: syncedEvents, error: syncedEventsError } = await supabase
    .from('synced_calendar_events')
    .select('google_event_id, task_id')

  if (syncedEventsError) {
    throw new Error(`Failed to get synced events: ${syncedEventsError.message}`)
  }

  // Get a fresh access token using refresh token
  const accessToken = await refreshGoogleToken(settings.refresh_token)

  // Map of task ID to Google event ID for existing synced events
  const taskToEventMap = new Map()
  syncedEvents?.forEach(event => {
    if (event.task_id) {
      taskToEventMap.set(event.task_id, event.google_event_id)
    }
  })

  const results = {
    created: 0,
    updated: 0,
    errors: 0,
  }

  // Process each task
  for (const task of tasks || []) {
    try {
      const startDate = new Date(task.date_started)
      const endDate = new Date(task.date_due)
      
      const event = {
        summary: task["Task Name"],
        description: `Task status: ${task.Progress}`,
        start: {
          dateTime: startDate.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: endDate.toISOString(),
          timeZone: 'UTC',
        },
        colorId: task.Progress === 'Not started' ? '5' : '9', // Blue for Not started, Green for In progress
      }

      const existingEventId = taskToEventMap.get(task.id)

      if (existingEventId) {
        // Update existing event
        const updateResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        )

        if (!updateResponse.ok) {
          throw new Error(`Failed to update event: ${await updateResponse.text()}`)
        }

        results.updated++
      } else {
        // Create new event
        const createResponse = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
          }
        )

        if (!createResponse.ok) {
          throw new Error(`Failed to create event: ${await createResponse.text()}`)
        }

        const newEvent = await createResponse.json()

        // Store the mapping
        await supabase
          .from('synced_calendar_events')
          .insert({
            google_event_id: newEvent.id,
            task_id: task.id,
            last_sync_time: new Date().toISOString(),
          })

        results.created++
      }
    } catch (error) {
      console.error(`Error processing task ${task.id}:`, error)
      results.errors++
    }
  }

  // Update last sync time
  await supabase
    .from('google_calendar_settings')
    .update({ last_sync_time: new Date().toISOString() })
    .eq('id', settings.id)

  return results
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method === 'POST') {
      const result = await syncTasks()
      
      return new Response(
        JSON.stringify(result),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in sync-google-calendar function:', error)
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
