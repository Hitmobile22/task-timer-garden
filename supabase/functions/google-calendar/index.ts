
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

async function getGoogleAuthURL(userId: string) {
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar/callback`
  const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events')
  const state = encodeURIComponent(userId) // Encode the user ID in the state parameter
  
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`
}

async function handleCallback(code: string, userId: string) {
  console.log('Handling callback with code:', code);
  const redirectUri = `${SUPABASE_URL}/functions/v1/google-calendar/callback`
  const tokenUrl = 'https://oauth2.googleapis.com/token'
  
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
  })

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Token exchange failed:', errorText);
    throw new Error(`Failed to get access token: ${errorText}`);
  }

  const data = await response.json()
  console.log('Received token data:', { 
    refresh_token: data.refresh_token ? 'present' : 'missing',
    access_token: data.access_token ? 'present' : 'missing'
  });
  return data
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    console.log('Received request for path:', url.pathname);
    
    if (req.method === 'POST') {
      const { action, userId } = await req.json()
      console.log('Received POST request with body:', { action, userId });
      
      if (action === 'auth' && userId) {
        const authUrl = await getGoogleAuthURL(userId)
        console.log('Generated auth URL:', authUrl);
        return new Response(
          JSON.stringify({ url: authUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }
    
    if (url.pathname.endsWith('/callback')) {
      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state') // Get the user ID from the state parameter
      
      if (!code || !state) {
        throw new Error('No code or state provided')
      }

      const userId = decodeURIComponent(state)
      const tokenData = await handleCallback(code, userId)
      
      // Store the refresh token in the database with the user ID
      const { data, error } = await supabase
        .from('google_calendar_settings')
        .upsert({
          user_id: userId,
          refresh_token: tokenData.refresh_token,
          sync_enabled: true,
          last_sync_time: new Date().toISOString(),
        })
        .select()

      if (error) {
        console.error('Database insert error:', error);
        throw error
      }

      console.log('Successfully stored refresh token for user:', userId);

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
