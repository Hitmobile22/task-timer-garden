
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Link, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const GoogleCalendarIntegration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Check if Google Calendar is already connected
  const { data: calendarSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['google-calendar-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('google_calendar_settings')
        .select('*')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      return data;
    }
  });

  const connectToGoogleCalendar = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: { action: 'auth', useSharedCalendar: true }
      });
      
      if (error) throw error;
      
      if (data?.url) {
        // Open Google auth in a popup
        const popup = window.open(data.url, 'google-auth', 'width=600,height=600');
        
        // Check periodically if the popup was closed
        const checkPopup = setInterval(async () => {
          if (!popup || popup.closed) {
            clearInterval(checkPopup);
            // Refresh settings to check if auth was successful
            await queryClient.invalidateQueries({ queryKey: ['google-calendar-settings'] });
            setIsLoading(false);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error connecting to Google Calendar:', error);
      toast.error('Failed to connect to Google Calendar');
      setIsLoading(false);
    }
  };

  const syncTasks = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');
      
      if (error) throw error;
      
      toast.success('Tasks synced to Google Calendar!');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
      console.error('Error syncing tasks:', error);
      toast.error('Failed to sync tasks to Google Calendar');
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('google_calendar_settings')
        .delete()
        .not('id', 'is', null);
      
      if (error) throw error;
      
      toast.success('Disconnected from Google Calendar');
      queryClient.invalidateQueries({ queryKey: ['google-calendar-settings'] });
    } catch (error) {
      console.error('Error disconnecting from Google Calendar:', error);
      toast.error('Failed to disconnect from Google Calendar');
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = !!calendarSettings?.refresh_token;

  return (
    <div className="space-y-2">
      {isConnected ? (
        <div className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground gap-2">
            <Calendar className="h-4 w-4" />
            <span>Connected to Google Calendar</span>
          </div>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={syncTasks}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link className="mr-2 h-4 w-4" />}
              Sync Tasks
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={disconnectGoogleCalendar}
              disabled={isLoading}
            >
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <Button 
          onClick={connectToGoogleCalendar} 
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
          Link to Google Calendar
        </Button>
      )}
    </div>
  );
};
