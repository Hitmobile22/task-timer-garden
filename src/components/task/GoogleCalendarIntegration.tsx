
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

// Create a utility function that can be exported and used by other components
export const syncGoogleCalendar = async (): Promise<boolean> => {
  try {
    // Check if calendar is connected before attempting sync
    const { data: settings } = await supabase
      .from('google_calendar_settings')
      .select('refresh_token')
      .eq('id', 'shared-calendar-settings')
      .maybeSingle();
    
    // If no refresh token, calendar is not connected, so no sync needed
    if (!settings?.refresh_token) {
      return false;
    }
    
    const { data, error } = await supabase.functions.invoke('sync-google-calendar');
    
    if (error) {
      console.error("Calendar sync error:", error);
      toast.error("Failed to sync tasks with Google Calendar");
      return false;
    }
    
    console.log("Calendar sync result:", data);
    return true;
  } catch (err) {
    console.error("Calendar sync error:", err);
    toast.error("Failed to sync tasks with Google Calendar");
    return false;
  }
};

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

  // Use the exported function for internal component needs too
  const triggerCalendarSync = syncGoogleCalendar;

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
          // Fix: Convert the Promise chain to use async/await to fix TypeScript error
          (async () => {
            try {
              const { data } = await supabase
                .from('google_calendar_settings')
                .select('refresh_token')
                .eq('id', 'shared-calendar-settings')
                .maybeSingle();
                
              if (data?.refresh_token) {
                setIsConnected(true);
                toast.success("Google Calendar connected! Your tasks will sync automatically.");
                
                // Trigger immediate sync after successful connection
                const success = await triggerCalendarSync();
                if (success) {
                  toast.success("Tasks synced to Google Calendar");
                }
              } else {
                toast.error("Failed to connect to Google Calendar. Please try again.");
              }
            } catch (err) {
              console.error("Failed to verify Google Calendar connection", err);
              toast.error("Failed to verify Google Calendar connection");
            } finally {
              setIsLoading(false);
            }
          })();
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
      
      // First clear all events from the calendar
      await triggerCalendarSync();
      
      // Fix: Use await instead of then/catch pattern for proper error handling
      try {
        await supabase
          .from('google_calendar_settings')
          .update({ 
            refresh_token: null,
            sync_enabled: false 
          })
          .eq('id', 'shared-calendar-settings');
        
        setIsConnected(false);
        toast.success("Google Calendar disconnected successfully.");
      } catch (error) {
        console.error("Failed to disconnect Google Calendar:", error);
        toast.error("Failed to disconnect Google Calendar");
      }
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
