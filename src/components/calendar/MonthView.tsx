
import React from 'react';
import { format, startOfMonth, getDaysInMonth, isSameDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Task } from '@/pages/Calendar';

interface MonthViewProps {
  date: Date;
  isMobile: boolean;
  getTasksForDay: (date: Date) => Task[];
  getTaskColor: (progress: Task['Progress']) => string;
}

export const MonthView: React.FC<MonthViewProps> = ({ 
  date, 
  isMobile, 
  getTasksForDay,
  getTaskColor
}) => {
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

  // Helper function for the MonthView
  function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(date.getDate() + days);
    return result;
  }
};
