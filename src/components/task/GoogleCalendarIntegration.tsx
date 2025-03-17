
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, RefreshCw } from "lucide-react";

// Create a utility function that can be exported and used by other components
export const syncGoogleCalendar = async (): Promise<boolean> => {
  try {
    console.log("Starting Google Calendar sync process...");
    
    // Check if calendar is connected before attempting sync
    const { data: settings, error: settingsError } = await supabase
      .from('google_calendar_settings')
      .select('refresh_token, calendar_id')
      .eq('id', 'shared-calendar-settings')
      .maybeSingle();
    
    if (settingsError) {
      console.error("Error checking calendar settings:", settingsError);
      toast.error("Failed to check calendar connection status");
      return false;
    }
    
    // If no refresh token, calendar is not connected, so no sync needed
    if (!settings?.refresh_token) {
      console.log("No refresh token found, skipping calendar sync");
      return false;
    }
    
    console.log("Refresh token found, proceeding with sync...");
    const { data, error } = await supabase.functions.invoke('sync-google-calendar');
    
    if (error) {
      console.error("Calendar sync error:", error);
      toast.error("Failed to sync tasks with Google Calendar");
      return false;
    }
    
    console.log("Calendar sync result:", data);
    toast.success("Successfully synced tasks with Google Calendar");
    return true;
  } catch (err) {
    console.error("Calendar sync error:", err);
    toast.error("Failed to sync with Google Calendar");
    return false;
  }
};

interface GoogleCalendarIntegrationProps {
  onManualSync?: () => Promise<void>;
}

export const GoogleCalendarIntegration: React.FC<GoogleCalendarIntegrationProps> = ({ onManualSync }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check if calendar is already connected on component mount
  useEffect(() => {
    const checkCalendarConnection = async () => {
      try {
        console.log("Checking Google Calendar connection status...");
        const { data, error } = await supabase
          .from('google_calendar_settings')
          .select('sync_enabled, refresh_token')
          .eq('id', 'shared-calendar-settings')
          .maybeSingle();
        
        if (error) {
          console.error("Error checking calendar connection:", error);
          return;
        }
        
        // If we have a record with a refresh token, consider it connected
        const connected = !!data?.refresh_token;
        console.log("Calendar connection status:", connected ? "Connected" : "Not connected");
        setIsConnected(connected);
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
      
      // Properly disconnect from Google Calendar
      const { error } = await supabase
        .from('google_calendar_settings')
        .update({ 
          refresh_token: null,
          sync_enabled: false 
        })
        .eq('id', 'shared-calendar-settings');
      
      if (error) {
        throw error;
      }
      
      setIsConnected(false);
      toast.success("Google Calendar disconnected successfully.");
    } catch (error) {
      console.error("Failed to disconnect Google Calendar:", error);
      toast.error("Failed to disconnect Google Calendar");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (isSyncing) return;
    
    if (onManualSync) {
      // Use the parent component's sync handler if provided
      setIsSyncing(true);
      try {
        await onManualSync();
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Otherwise use our internal sync logic
      try {
        setIsSyncing(true);
        toast.info("Syncing tasks with Google Calendar...");
        
        const success = await triggerCalendarSync();
        
        if (success) {
          toast.success("All tasks synced to Google Calendar successfully");
        }
      } catch (error) {
        console.error("Manual calendar sync error:", error);
        toast.error("Failed to sync with Google Calendar");
      } finally {
        setIsSyncing(false);
      }
    }
  };

  return (
    <div className="flex gap-2">
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
    </div>
  );
};
