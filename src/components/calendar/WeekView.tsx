
import React from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Task } from '@/pages/Calendar';

interface WeekViewProps {
  date: Date;
  isMobile: boolean;
  getTasksForDay: (date: Date) => Task[];
  getTaskColor: (progress: Task['Progress']) => string;
}

export const WeekView: React.FC<WeekViewProps> = ({ 
  date, 
  isMobile, 
  getTasksForDay,
  getTaskColor
}) => {
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
