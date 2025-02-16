
import React from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

export const GoogleCalendarIntegration = () => {
  const [isConnecting, setIsConnecting] = React.useState(false);

  const handleGoogleAuth = async () => {
    try {
      setIsConnecting(true);
      console.log('Initiating Google Calendar authentication...');
      
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'auth' }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (!data?.url) {
        console.error('No auth URL received:', data);
        throw new Error('Failed to get authentication URL');
      }

      console.log('Opening auth window with URL:', data.url);
      
      // Open the Google OAuth window
      const authWindow = window.open(
        data.url,
        'Google Calendar Auth',
        'width=500,height=600'
      );

      if (authWindow) {
        const timer = setInterval(async () => {
          if (authWindow.closed) {
            clearInterval(timer);
            setIsConnecting(false);
            
            // Check if we actually completed the auth flow
            const { data: settings, error: fetchError } = await supabase
              .from('google_calendar_settings')
              .select('refresh_token, sync_enabled')
              .maybeSingle();

            if (fetchError) {
              console.error('Failed to verify auth completion:', fetchError);
              toast.error('Failed to verify Google Calendar connection');
              return;
            }

            if (settings?.refresh_token && settings.sync_enabled) {
              toast.success('Successfully connected to Google Calendar!');
            } else {
              toast.error('Google Calendar connection was not completed. Please try again.');
            }
          }
        }, 500);
      } else {
        setIsConnecting(false);
        throw new Error('Failed to open authentication window');
      }
    } catch (error) {
      console.error('Google Calendar auth error:', error);
      toast.error('Failed to connect to Google Calendar: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={handleGoogleAuth}
        disabled={isConnecting}
        className="gap-2"
      >
        <Calendar className="h-4 w-4" />
        {isConnecting ? 'Connecting...' : 'Connect Google Calendar'}
      </Button>
    </div>
  );
};
