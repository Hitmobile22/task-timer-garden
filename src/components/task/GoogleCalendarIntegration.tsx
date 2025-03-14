
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

export const GoogleCalendarIntegration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Check if calendar is already connected on component mount
  useEffect(() => {
    const checkCalendarConnection = async () => {
      try {
        const { data } = await supabase
          .from('google_calendar_settings')
          .select('sync_enabled, refresh_token')
          .eq('id', 'shared-calendar-settings')
          .maybeSingle();
        
        // If we have a record with a refresh token, consider it connected
        setIsConnected(!!data?.refresh_token);
      } catch (error) {
        console.error("Error checking calendar connection:", error);
      }
    };

    checkCalendarConnection();
  }, []);

  const handleGoogleCalendarAuth = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'auth'
        }
      });

      if (error) {
        throw error;
      }

      // Open the Google authorization URL in a new window
      const authWindow = window.open(data.url, '_blank', 'width=600,height=700');
      
      // Check if the window was blocked
      if (!authWindow) {
        toast.error("Pop-up blocked. Please allow pop-ups for this site.");
        setIsLoading(false);
        return;
      }

      // Set a timer to check if the window is closed
      const checkWindowClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkWindowClosed);
          
          // Double-check that integration was successful by querying the database
          supabase
            .from('google_calendar_settings')
            .select('refresh_token')
            .eq('id', 'shared-calendar-settings')
            .maybeSingle()
            .then(({ data }) => {
              if (data?.refresh_token) {
                setIsConnected(true);
                toast.success("Google Calendar connected! Your tasks will sync automatically.");
              } else {
                toast.error("Failed to connect to Google Calendar. Please try again.");
              }
              setIsLoading(false);
            })
            .catch(() => {
              toast.error("Failed to verify Google Calendar connection");
              setIsLoading(false);
            });
        }
      }, 1000);

    } catch (error) {
      console.error("Google Calendar auth error:", error);
      toast.error("Failed to connect to Google Calendar");
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('google_calendar_settings')
        .update({ 
          refresh_token: null,
          sync_enabled: false 
        })
        .eq('id', 'shared-calendar-settings');
      
      if (error) throw error;
      
      setIsConnected(false);
      toast.success("Google Calendar disconnected successfully.");
    } catch (error) {
      console.error("Failed to disconnect Google Calendar:", error);
      toast.error("Failed to disconnect Google Calendar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant={isConnected ? "destructive" : "outline"} 
      className="flex items-center gap-2" 
      onClick={isConnected ? handleDisconnect : handleGoogleCalendarAuth}
      disabled={isLoading}
    >
      <Calendar className="w-4 h-4" />
      {isLoading 
        ? "Processing..." 
        : isConnected 
          ? "Disconnect Google Calendar" 
          : "Link to Google Calendar"
      }
    </Button>
  );
};
