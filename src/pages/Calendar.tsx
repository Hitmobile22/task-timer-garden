import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, addDays, startOfMonth, getDaysInMonth } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from "@/components/ui/scroll-area";

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
    return tasks?.filter(task => {
      const taskStart = new Date(task.date_started);
      const taskDue = new Date(task.date_due);
      return taskStart <= date && taskDue >= date;
    });
  };

  const TimelineTask = ({ task }: { task: Task }) => {
    const startTime = new Date(task.date_started);
    const endTime = new Date(task.date_due);
    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    
    return (
      <div 
        className="absolute left-[120px] right-4 rounded p-2 text-sm"
        style={{
          top: `${startHour * 60}px`,
          height: `${duration * 60}px`,
          background: task.Progress === 'Completed' 
            ? 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)'
            : task.Progress === 'In progress'
            ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
            : 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
          color: 'white',
        }}
      >
        <div className="font-medium">{task["Task Name"]}</div>
        <div className="text-xs opacity-80">
          {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
        </div>
      </div>
    );
  };

  const DayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayTasks = getTasksForDay(date) || [];

    return (
      <ScrollArea className="h-[600px] relative">
        <div className="relative">
          {hours.map(hour => (
            <div 
              key={hour} 
              className="flex items-start h-[60px] border-t border-gray-200"
            >
              <div className="w-[100px] pr-4 text-sm text-gray-500 sticky left-0 bg-white">
                {format(new Date().setHours(hour, 0), 'h:mm a')}
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
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map(day => (
          <div key={day.toString()} className="space-y-2">
            <div className="text-sm font-medium text-center p-2 bg-muted rounded">
              {format(day, 'EEE dd')}
            </div>
            <div className="space-y-2">
              {getTasksForDay(day)?.map(task => (
                <div 
                  key={task.id}
                  className="p-2 rounded text-sm"
                  style={{
                    background: task.Progress === 'Completed' 
                      ? 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)'
                      : task.Progress === 'In progress'
                      ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
                      : 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                    color: 'white',
                  }}
                >
                  <div className="font-medium">{task["Task Name"]}</div>
                  <div className="text-xs opacity-80">
                    {format(new Date(task.date_started), 'h:mm a')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const MonthView = () => {
    const monthStart = startOfMonth(date);
    const daysInMonth = getDaysInMonth(date);
    const days = Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));

    return (
      <div className="grid grid-cols-7 gap-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-sm font-medium text-center p-2">
            {day}
          </div>
        ))}
        {Array(monthStart.getDay()).fill(null).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => (
          <div key={day.toString()} className="min-h-[100px] border rounded p-1">
            <div className="text-sm text-gray-500 mb-1">
              {format(day, 'd')}
            </div>
            <ScrollArea className="h-[80px]">
              <div className="space-y-1">
                {getTasksForDay(day)?.map(task => (
                  <div 
                    key={task.id}
                    className="p-1 rounded text-xs"
                    style={{
                      background: task.Progress === 'Completed' 
                        ? 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)'
                        : task.Progress === 'In progress'
                        ? 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)'
                        : 'linear-gradient(135deg, #fb923c 0%, #f97316 100%)',
                      color: 'white',
                    }}
                  >
                    {task["Task Name"]}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-6xl">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <main className="container mx-auto max-w-6xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Calendar</h1>
          <p className="text-white/80">View your tasks in calendar format</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
          <Tabs defaultValue="day" className="w-full" onValueChange={(v) => setView(v as 'day' | 'week' | 'month')}>
            <div className="flex flex-col space-y-8">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="day">Today</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                  <TabsTrigger value="month">Month</TabsTrigger>
                </TabsList>
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={(date) => date && setDate(date)}
                  className="rounded-md border"
                />
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
        </div>
      </main>
    </div>
  );
}
