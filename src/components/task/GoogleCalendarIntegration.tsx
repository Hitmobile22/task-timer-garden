
import React from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

export const GoogleCalendarIntegration = () => {
  const [isConnecting, setIsConnecting] = React.useState(false);

  const handleGoogleAuth = async () => {
    try {
      console.log('Button clicked, starting authentication process...');
      setIsConnecting(true);
      
      const { data: authData, error: authError } = await supabase.auth.getUser();
      console.log('Auth check result:', { user: authData?.user, error: authError });
      
      if (!authData?.user) {
        console.error('No authenticated user found');
        toast.error('Please sign in to connect Google Calendar');
        setIsConnecting(false);
        return;
      }

      console.log('Starting Google Calendar auth with user:', authData.user.id);
      
      console.log('Invoking google-calendar function...');
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { 
          action: 'auth',
          userId: authData.user.id
        }
      });
      console.log('Function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (!data?.url) {
        console.error('No auth URL received:', data);
        throw new Error('Failed to get authentication URL');
      }

      console.log('Opening auth window with URL:', data.url);
      
      const authWindow = window.open(
        data.url,
        'Google Calendar Auth',
        'width=500,height=600'
      );

      if (authWindow) {
        console.log('Auth window opened successfully');
        const timer = setInterval(async () => {
          if (authWindow.closed) {
            console.log('Auth window was closed');
            clearInterval(timer);
            setIsConnecting(false);
            
            console.log('Auth window closed, checking settings...');
            
            // Add a small delay to allow the database to update
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check if we actually completed the auth flow
            const { data: settings, error: fetchError } = await supabase
              .from('google_calendar_settings')
              .select('refresh_token, sync_enabled')
              .single();

            console.log('Settings check result:', { settings, fetchError });

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
        console.error('Failed to open auth window');
        setIsConnecting(false);
        throw new Error('Failed to open authentication window');
      }
    } catch (error) {
      console.error('Google Calendar auth error:', error);
      toast.error('Failed to connect to Google Calendar: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setIsConnecting(false);
    }
  };

  React.useEffect(() => {
    // Check if user is authenticated on component mount
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Initial auth check:', { isAuthenticated: !!user });
    };
    checkAuth();
  }, []);

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
