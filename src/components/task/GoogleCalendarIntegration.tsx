
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar } from "lucide-react";

export const GoogleCalendarIntegration = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleCalendarAuth = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'auth',
          userId: 'shared-calendar' // Using a shared calendar approach
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
        return;
      }

      // Set a timer to check if the window is closed
      const checkWindowClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkWindowClosed);
          toast.success("Google Calendar connected! Your tasks will sync automatically.");
          setIsLoading(false);
        }
      }, 1000);

    } catch (error) {
      console.error("Google Calendar auth error:", error);
      toast.error("Failed to connect to Google Calendar");
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      className="flex items-center gap-2" 
      onClick={handleGoogleCalendarAuth}
      disabled={isLoading}
    >
      <Calendar className="w-4 h-4" />
      {isLoading ? "Connecting..." : "Link to Google Calendar"}
    </Button>
  );
};
