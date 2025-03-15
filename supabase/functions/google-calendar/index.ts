
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

async function getGoogleAuthURL() {
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar/callback`
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events')
  const state = encodeURIComponent('shared') // Use a fixed value for state
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`
}

async function handleCallback(code) {
  console.log('Handling callback with code:', code);
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar/callback`
  const tokenUrl = 'https://oauth2.googleapis.com/token'
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: GOOGLE_OAUTH_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', errorText);
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    const data = await response.json();
    console.log('Received token data:', { 
      refresh_token: data.refresh_token ? 'present' : 'missing',
      access_token: data.access_token ? 'present' : 'missing'
    });
    
    if (!data.refresh_token) {
      console.error('No refresh token received from Google. This likely means the user has already authorized this app before.');
      throw new Error('No refresh token received from Google. Please revoke app access in your Google account and try again.');
    }
    
    // Check if we received a calendar ID in the API response
    // If not, we may need to create a new calendar
    let calendarId = null;
    if (data.access_token) {
      try {
        // Try to get primary calendar or create a new calendar
        const calendarResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`
          }
        });
        
        if (calendarResponse.ok) {
          const calendarData = await calendarResponse.json();
          calendarId = calendarData.id;
          console.log("Using primary calendar with ID:", calendarId);
        }
      } catch (error) {
        console.error('Error getting calendar ID:', error);
        // We'll still continue even if this fails
      }
    }
    
    return { ...data, calendarId };
  } catch (error) {
    console.error("Token exchange error:", error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    console.log('Received request for path:', url.pathname);
    
    if (req.method === 'POST') {
      const { action } = await req.json()
      console.log('Received POST request with body:', { action });
      
      if (action === 'auth') {
        const authUrl = await getGoogleAuthURL()
        console.log('Generated auth URL:', authUrl);
        return new Response(
          JSON.stringify({ url: authUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    if (url.pathname.endsWith('/callback')) {
      const code = url.searchParams.get('code')
      
      if (!code) {
        throw new Error('No code provided')
      }

      const tokenData = await handleCallback(code)
      
      // Clear any existing data first
      await supabase
        .from('google_calendar_settings')
        .delete()
        .eq('id', 'shared-calendar-settings');
      
      // Store the refresh token in the database using text ID
      const { data, error } = await supabase
        .from('google_calendar_settings')
        .insert({
          id: 'shared-calendar-settings', // Fixed text ID
          refresh_token: tokenData.refresh_token,
          calendar_id: tokenData.calendarId,
          sync_enabled: true,
          last_sync_time: new Date().toISOString(),
        })
        .select()

      if (error) {
        console.error('Database insert error:', error);
        throw error
      }

      console.log('Successfully stored refresh token');

      // Trigger an initial sync
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/sync-google-calendar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
      } catch (syncError) {
        console.error('Initial sync failed:', syncError);
        // We continue anyway as this is not critical
      }

      return new Response(
        `<html><body><script>window.close()</script></body></html>`,
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid endpoint' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
