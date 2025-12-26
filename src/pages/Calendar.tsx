import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { MenuBar } from "@/components/MenuBar";
import { syncGoogleCalendar } from "@/components/task/GoogleCalendarIntegration";
import { toast } from "sonner";
import { DayView } from '@/components/calendar/DayView';
import { WeekView } from '@/components/calendar/WeekView';
import { MonthView } from '@/components/calendar/MonthView';
import { CalendarHeader } from '@/components/calendar/CalendarHeader';
import { getEventsForDay } from '@/components/calendar/CalendarUtils';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Task, Project, CalendarEvent } from '@/types/calendar.types';

const Calendar = () => {
  const [date, setDate] = React.useState<Date>(new Date());
  const [view, setView] = React.useState<'day' | 'week' | 'month'>('day');
  const isMobile = useIsMobile();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCalendarConnected, setIsCalendarConnected] = useState(false);
  
  // Check if Google Calendar is connected
  useEffect(() => {
    const checkCalendarConnection = async () => {
      try {
        const { data } = await supabase
          .from('google_calendar_settings')
          .select('refresh_token')
          .eq('id', 'shared-calendar-settings')
          .maybeSingle();
        
        setIsCalendarConnected(!!data?.refresh_token);
      } catch (error) {
        console.error("Error checking calendar connection:", error);
      }
    };
    
    checkCalendarConnection();
  }, []);

  // Fetch tasks with dates
  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: ['calendar-tasks'],
    queryFn: async () => {
      console.log("Fetching tasks for calendar view...");
      const { data, error } = await supabase
        .from('Tasks')
        .select('id, "Task Name", Progress, date_started, date_due')
        .not('date_started', 'is', null)
        .not('date_due', 'is', null)
        .eq('archived', false)
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      return data as Task[];
    },
  });

  // Fetch projects with due dates
  const { data: projects, refetch: refetchProjects } = useQuery({
    queryKey: ['calendar-projects'],
    queryFn: async () => {
      console.log("Fetching projects for calendar view...");
      const { data, error } = await supabase
        .from('Projects')
        .select('id, "Project Name", progress, date_started, date_due, archived')
        .not('date_due', 'is', null)
        .eq('archived', false)
        .order('date_due', { ascending: true });
      
      if (error) throw error;
      return data as Project[];
    },
  });

  const handleRefreshCalendar = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      
      // Check calendar connection status first
      const { data: settings } = await supabase
        .from('google_calendar_settings')
        .select('refresh_token')
        .eq('id', 'shared-calendar-settings')
        .maybeSingle();
        
      if (!settings?.refresh_token) {
        toast.error("Google Calendar is not connected. Please connect it first.");
        setIsSyncing(false);
        return;
      }
      
      toast.info("Syncing tasks and projects with Google Calendar...");
      
      console.log("Calendar sync initiated from Calendar page");
      const success = await syncGoogleCalendar();
      
      if (success) {
        toast.success("All tasks and projects synced to Google Calendar");
        console.log("Google Calendar sync successful, refreshing data");
        await Promise.all([refetchTasks(), refetchProjects()]);
      } else {
        console.log("Google Calendar sync returned false");
        toast.error("Failed to sync with Google Calendar. Make sure your calendar is connected.");
      }
    } catch (error) {
      console.error("Calendar refresh error:", error);
      toast.error("Failed to sync with Google Calendar");
    } finally {
      setIsSyncing(false);
    }
  };

  // Get events for a specific day (combining tasks and projects)
  const getEventsForCurrentDay = (targetDate: Date): CalendarEvent[] => {
    return getEventsForDay(tasks, projects, targetDate);
  };

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-4xl flex justify-between items-center">
        <MenuBar />
        <NotificationBell />
      </div>
      
      <main className="container mx-auto max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Calendar</h1>
          <p className="text-white/80">View your tasks and project deadlines</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg max-w-[1400px] mx-auto">
          <Tabs defaultValue="day" className="w-full" onValueChange={(v) => setView(v as 'day' | 'week' | 'month')}>
            <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-start justify-between'} mb-6`}>
              <div className="flex-1" />
              
              <div className="flex flex-col items-end gap-4">
                <CalendarHeader 
                  handleRefreshCalendar={handleRefreshCalendar}
                  isSyncing={isSyncing}
                />
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={(date) => date && setDate(date)}
                  className="rounded-md border"
                />
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="day">Today</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent value="day" className="m-0">
              <DayView 
                date={date}
                events={getEventsForCurrentDay(date)}
              />
            </TabsContent>

            <TabsContent value="week" className="m-0">
              <WeekView 
                date={date}
                isMobile={isMobile}
                getEventsForDay={getEventsForCurrentDay}
              />
            </TabsContent>

            <TabsContent value="month" className="m-0">
              <MonthView 
                date={date}
                isMobile={isMobile}
                getEventsForDay={getEventsForCurrentDay}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Calendar;
