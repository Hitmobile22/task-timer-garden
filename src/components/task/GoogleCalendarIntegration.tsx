
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
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'auth' }
      });

      if (error) throw error;

      // Open the Google OAuth window
      const authWindow = window.open(
        data.url,
        'Google Calendar Auth',
        'width=500,height=600'
      );

      if (authWindow) {
        const timer = setInterval(() => {
          if (authWindow.closed) {
            clearInterval(timer);
            setIsConnecting(false);
            toast.success('Successfully connected to Google Calendar');
          }
        }, 500);
      }
    } catch (error) {
      console.error('Google Calendar auth error:', error);
      toast.error('Failed to connect to Google Calendar');
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
