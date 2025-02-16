
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays, startOfMonth, getDaysInMonth, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MenuBar } from "@/components/MenuBar";

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

  const getTasksForDay = (date: Date) => {
    if (!tasks) return [];
    return tasks.filter(task => {
      const taskStart = new Date(task.date_started);
      const taskDue = new Date(task.date_due);
      const taskDate = new Date(date);
      
      // Reset hours to compare dates only
      taskDate.setHours(0, 0, 0, 0);
      const startDate = new Date(taskStart);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(taskDue);
      endDate.setHours(0, 0, 0, 0);
      
      return startDate <= taskDate && endDate >= taskDate;
    });
  };

  const getTaskColor = (progress: Task['Progress']) => {
    switch (progress) {
      case 'Completed':
        return 'bg-emerald-500';
      case 'In progress':
        return 'bg-blue-500';
      case 'Not started':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  const DayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayTasks = getTasksForDay(date);

    return (
      <div className="relative h-[calc(100vh-300px)] overflow-auto">
        <div className="sticky top-0 bg-background z-10 py-2 mb-4">
          <h2 className="text-lg font-semibold">
            {format(date, 'EEEE, MMMM d')}
          </h2>
        </div>
        <div className="space-y-2">
          {dayTasks.map((task) => (
            <Card key={task.id} className="border border-border">
              <CardHeader className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{task["Task Name"]}</CardTitle>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="mr-2 h-4 w-4" />
                      {format(new Date(task.date_started), 'h:mm a')} - {format(new Date(task.date_due), 'h:mm a')}
                    </div>
                  </div>
                  <div className={`${getTaskColor(task.Progress)} px-2 py-1 rounded text-xs text-white`}>
                    {task.Progress}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  const WeekView = () => {
    const startDate = startOfWeek(date);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

    return (
      <div className="space-y-6">
        <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-7 gap-3'}`}>
          {weekDays.map((day) => {
            const dayTasks = getTasksForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <Card 
                key={day.toString()} 
                className={`${isToday ? 'border-primary' : ''}`}
              >
                <CardHeader className="p-3">
                  <CardTitle className={`text-sm ${isToday ? 'text-primary' : ''}`}>
                    {format(day, isMobile ? 'EEE, MMM d' : 'EEE d')}
                  </CardTitle>
                </CardHeader>
                <Separator />
                <CardContent className="p-2">
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`${getTaskColor(task.Progress)} p-2 rounded text-white text-sm`}
                        >
                          <div className="font-medium">{task["Task Name"]}</div>
                          <div className="text-xs mt-1 opacity-90">
                            {format(new Date(task.date_started), 'h:mm a')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
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
            <div key={day} className="text-sm font-medium text-center p-2 text-muted-foreground">
              {day}
            </div>
          ))}
          {!isMobile && Array(monthStart.getDay()).fill(null).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => {
            const dayTasks = getTasksForDay(day);
            const isToday = isSameDay(day, new Date());

            return (
              <Card 
                key={day.toString()} 
                className={`min-h-[120px] ${isToday ? 'border-primary' : ''}`}
              >
                <CardHeader className="p-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm ${isToday ? 'text-primary' : ''}`}>
                      {format(day, isMobile ? 'EEE, MMM d' : 'd')}
                    </CardTitle>
                    {dayTasks.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-2">
                  <ScrollArea className="h-[80px]">
                    <div className="space-y-1">
                      {dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className={`${getTaskColor(task.Progress)} p-1.5 rounded text-white text-xs`}
                        >
                          {task["Task Name"]}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background animate-fadeIn">
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <MenuBar />
        </div>

        <div className="space-y-8">
          <header className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Calendar</h1>
            <p className="text-muted-foreground">View your tasks in calendar format</p>
          </header>

          <Card>
            <CardContent className="p-6">
              <Tabs defaultValue="day" className="w-full" onValueChange={(v) => setView(v as 'day' | 'week' | 'month')}>
                <div className="flex flex-col space-y-6">
                  <div className={`flex ${isMobile ? 'flex-col gap-4' : 'items-center justify-between'}`}>
                    <TabsList className="grid w-full sm:w-auto grid-cols-3">
                      <TabsTrigger value="day">Today</TabsTrigger>
                      <TabsTrigger value="week">Week</TabsTrigger>
                      <TabsTrigger value="month">Month</TabsTrigger>
                    </TabsList>
                    <Card className="border">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
