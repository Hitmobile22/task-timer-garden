
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from 'react-router-dom';

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

  const getTasksForWeek = () => {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    
    return tasks?.filter(task => {
      const taskStart = new Date(task.date_started);
      const taskDue = new Date(task.date_due);
      return taskStart <= end && taskDue >= start;
    });
  };

  const getTasksForMonth = () => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    return tasks?.filter(task => {
      const taskStart = new Date(task.date_started);
      const taskDue = new Date(task.date_due);
      return taskStart <= end && taskDue >= start;
    });
  };

  const TaskList = ({ tasks }: { tasks: Task[] }) => (
    <div className="space-y-3">
      {tasks.map(task => (
        <div 
          key={task.id}
          className="p-3 rounded-lg glass"
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
          <div className="text-sm opacity-80 mt-1">
            {format(new Date(task.date_started), 'MMM d, h:mm a')} - {format(new Date(task.date_due), 'MMM d, h:mm a')}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-4xl">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <main className="container mx-auto max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Calendar</h1>
          <p className="text-white/80">View your tasks in calendar format</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
          <Tabs defaultValue="day" className="w-full" onValueChange={(v) => setView(v as 'day' | 'week' | 'month')}>
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="day">Today</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
            
            <div className="grid md:grid-cols-[auto,1fr] gap-8">
              <div className="w-full md:w-auto">
                <CalendarComponent
                  mode="single"
                  selected={date}
                  onSelect={(date) => date && setDate(date)}
                  className="rounded-md border"
                />
              </div>

              <div className="space-y-8">
                <TabsContent value="day" className="m-0">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      Tasks for {format(date, 'MMMM d, yyyy')}
                    </h3>
                    <TaskList tasks={getTasksForDay(date) || []} />
                  </div>
                </TabsContent>

                <TabsContent value="week" className="m-0">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      Tasks for week of {format(date, 'MMMM d, yyyy')}
                    </h3>
                    <TaskList tasks={getTasksForWeek() || []} />
                  </div>
                </TabsContent>

                <TabsContent value="month" className="m-0">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      Tasks for {format(date, 'MMMM yyyy')}
                    </h3>
                    <TaskList tasks={getTasksForMonth() || []} />
                  </div>
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
