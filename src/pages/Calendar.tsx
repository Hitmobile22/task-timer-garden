
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays, startOfMonth, getDaysInMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type Task = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  date_started: string;
  date_due: string;
};

export default function CalendarView() {
  const navigate = useNavigate();
  const [date, setDate] = React.useState<Date>(new Date());
  const [view, setView] = React.useState<'day' | 'week' | 'month'>('day');
  const isMobile = useIsMobile();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
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

  React.useEffect(() => {
    if (view === 'day' && scrollRef.current) {
      const scrollPosition = 7 * 60; // 7 hours * 60 pixels per hour
      scrollRef.current.scrollTop = scrollPosition;
    }
  }, [view]);

  const getTasksForDay = (date: Date) => {
    return tasks?.filter(task => {
      const taskStart = new Date(task.date_started);
      const taskDue = new Date(task.date_due);
      return taskStart <= date && taskDue >= date;
    });
  };

  const getTaskColor = (progress: Task['Progress']) => {
    switch (progress) {
      case 'Completed':
        return 'bg-gradient-to-br from-emerald-400 to-emerald-500';
      case 'In progress':
        return 'bg-gradient-to-br from-blue-400 to-blue-500';
      case 'Not started':
        return 'bg-gradient-to-br from-orange-400 to-orange-500';
      default:
        return 'bg-gradient-to-br from-gray-400 to-gray-500';
    }
  };

  const TimelineTask = ({ task }: { task: Task }) => {
    const startTime = new Date(task.date_started);
    const endTime = new Date(task.date_due);
    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    return (
      <div 
        className={`absolute left-[120px] right-4 rounded-lg shadow-sm p-3 text-sm ${getTaskColor(task.Progress)} transition-all hover:translate-x-1 hover:shadow-md cursor-pointer`}
        style={{
          top: `${startHour * 60}px`,
          height: `${duration * 60}px`,
          color: 'white',
        }}
      >
        <div className="font-medium">{task["Task Name"]}</div>
        <div className="text-xs opacity-90 flex items-center gap-1 mt-1">
          <Clock className="h-3 w-3" />
          {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
        </div>
      </div>
    );
  };

  const DayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayTasks = getTasksForDay(date) || [];

    return (
      <ScrollArea ref={scrollRef} className="h-[calc(100vh-300px)] min-h-[500px] relative">
        <div className="relative">
          {hours.map(hour => (
            <div 
              key={hour} 
              className="flex items-start h-[60px] border-t border-gray-200"
            >
              <div className="w-[100px] pr-4 text-sm text-gray-500 sticky left-0 bg-white z-10 font-medium">
                {format(new Date().setHours(hour, 0), 'h:mm a')}
              </div>
              <div className="flex-1 relative">
                {hour % 2 === 0 && (
                  <div className="absolute inset-0 bg-gray-50/50" />
                )}
              </div>
            </div>
          ))}
          {dayTasks.map(task => (
            <TimelineTask key={task.id} task={task} />
          ))}
        </div>
      </ScrollArea>
    );
  };

  const WeekView = () => {
    const startDate = startOfWeek(date);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

    return (
      <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-7 gap-3'}`}>
        {weekDays.map(day => (
          <Card key={day.toString()} className="overflow-hidden">
            <CardHeader className="p-3 space-y-0">
              <CardTitle className="text-sm font-medium">
                {format(day, isMobile ? 'EEE, MMM dd' : 'EEE dd')}
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="p-3">
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {getTasksForDay(day)?.map(task => (
                    <div 
                      key={task.id}
                      className={`p-2 rounded-lg text-sm ${getTaskColor(task.Progress)} text-white transition-all hover:translate-x-1 cursor-pointer`}
                    >
                      <div className="font-medium">{task["Task Name"]}</div>
                      <div className="text-xs opacity-90 flex items-center gap-1 mt-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(task.date_started), 'h:mm a')}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const MonthView = () => {
    const monthStart = startOfMonth(date);
    const daysInMonth = getDaysInMonth(date);
    const days = Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));

    return (
      <div className="space-y-4">
        <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-7 gap-3'}`}>
          {!isMobile && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-sm font-medium text-center p-2">
              {day}
            </div>
          ))}
          {!isMobile && Array(monthStart.getDay()).fill(null).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map(day => (
            <Card key={day.toString()} className="min-h-[120px] overflow-hidden">
              <CardHeader className="p-3 space-y-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {format(day, isMobile ? 'EEE, MMM d' : 'd')}
                  </CardTitle>
                  {getTasksForDay(day)?.length > 0 && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                      {getTasksForDay(day)?.length} tasks
                    </span>
                  )}
                </div>
              </CardHeader>
              <Separator />
              <CardContent className="p-2">
                <ScrollArea className="h-[80px]">
                  <div className="space-y-1">
                    {getTasksForDay(day)?.map(task => (
                      <div 
                        key={task.id}
                        className={`p-1.5 rounded-md text-xs ${getTaskColor(task.Progress)} text-white transition-all hover:translate-x-1 cursor-pointer`}
                      >
                        {task["Task Name"]}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-6 space-y-8 animate-fadeIn bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto max-w-6xl">
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-white/20"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <main className="container mx-auto max-w-6xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">View your tasks in calendar format</p>
        </header>

        <Card className="p-6">
          <Tabs defaultValue="day" className="w-full" onValueChange={(v) => setView(v as 'day' | 'week' | 'month')}>
            <div className="flex flex-col space-y-6">
              <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between'}`}>
                <TabsList className="grid w-full sm:w-auto grid-cols-3">
                  <TabsTrigger value="day">Today</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
                <Card className="border-2">
                  <CalendarComponent
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    className="rounded-md"
                  />
                </Card>
              </div>

              <TabsContent value="day" className="m-0">
                <DayView />
              </TabsContent>

              <TabsContent value="week" className="m-0">
                <WeekView />
              </TabsContent>

              <TabsContent value="month" className="m-0">
                <MonthView />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </main>
    </div>
  );
}
