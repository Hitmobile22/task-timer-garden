
import React, { useState } from 'react';
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
import { getTasksForDay, getTaskColor } from '@/components/calendar/CalendarUtils';

export type Task = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  date_started: string;
  date_due: string;
};

const Calendar = () => {
  const [date, setDate] = React.useState<Date>(new Date());
  const [view, setView] = React.useState<'day' | 'week' | 'month'>('day');
  const isMobile = useIsMobile();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: tasks, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      console.log("Fetching tasks for calendar view...");
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .not('date_started', 'is', null)
        .not('date_due', 'is', null)
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      return data as Task[];
    },
  });

  const handleRefreshCalendar = async () => {
    if (isSyncing) return;
    
    try {
      setIsSyncing(true);
      toast.info("Syncing tasks with Google Calendar...");
      
      console.log("Calendar sync initiated from Calendar page");
      const success = await syncGoogleCalendar();
      
      if (success) {
        toast.success("All tasks synced to Google Calendar successfully");
        console.log("Google Calendar sync successful, refreshing task data");
        await refetch();
      } else {
        console.log("Google Calendar sync returned false, check if calendar is connected");
        toast.error("Failed to sync with Google Calendar. Make sure your calendar is connected.");
      }
    } catch (error) {
      console.error("Calendar refresh error:", error);
      toast.error("Failed to sync with Google Calendar");
    } finally {
      setIsSyncing(false);
    }
  };

  // Wrapper functions to pass the tasks to the utility functions
  const getTasksForCurrentDay = (date: Date) => getTasksForDay(tasks, date);

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-4xl flex justify-between items-center">
        <MenuBar />
      </div>
      
      <main className="container mx-auto max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Calendar</h1>
          <p className="text-white/80">View your tasks in calendar format</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg max-w-[1400px] mx-auto">
          <CalendarHeader 
            handleRefreshCalendar={handleRefreshCalendar}
            isSyncing={isSyncing}
          />
          
          <Tabs defaultValue="day" className="w-full" onValueChange={(v) => setView(v as 'day' | 'week' | 'month')}>
            <div className="flex flex-col space-y-6">
              <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between'}`}>
                <TabsList className="grid w-full sm:w-auto grid-cols-3">
                  <TabsTrigger value="day">Today</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={(date) => date && setDate(date)}
                  className="rounded-md"
                />
              </div>

              <TabsContent value="day" className="m-0">
                <DayView 
                  date={date}
                  tasks={tasks}
                  getTasksForDay={getTasksForCurrentDay}
                  getTaskColor={getTaskColor}
                />
              </TabsContent>

              <TabsContent value="week" className="m-0">
                <WeekView 
                  date={date}
                  isMobile={isMobile}
                  getTasksForDay={getTasksForCurrentDay}
                  getTaskColor={getTaskColor}
                />
              </TabsContent>

              <TabsContent value="month" className="m-0">
                <MonthView 
                  date={date}
                  isMobile={isMobile}
                  getTasksForDay={getTasksForCurrentDay}
                  getTaskColor={getTaskColor}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Calendar;
