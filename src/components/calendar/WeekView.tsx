import React from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen } from "lucide-react";
import { CalendarEvent } from '@/types/calendar.types';
import { getEventColor } from './CalendarUtils';

interface WeekViewProps {
  date: Date;
  isMobile: boolean;
  getEventsForDay: (date: Date) => CalendarEvent[];
}

export const WeekView: React.FC<WeekViewProps> = ({ 
  date, 
  isMobile, 
  getEventsForDay
}) => {
  const startDate = startOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  return (
    <div className="space-y-6">
      <div className={`grid ${isMobile ? 'grid-cols-1 gap-4' : 'grid-cols-7 gap-3'}`}>
        {weekDays.map((day) => {
          const dayEvents = getEventsForDay(day);
          const allDayEvents = dayEvents.filter(e => e.isAllDay);
          const timedEvents = dayEvents.filter(e => !e.isAllDay);
          const isToday = isSameDay(day, new Date());

          return (
            <Card 
              key={day.toString()} 
              className={`${isToday ? 'border-primary ring-1 ring-primary/20' : ''}`}
            >
              <CardHeader className="p-3">
                <CardTitle className={`text-sm ${isToday ? 'text-primary font-bold' : ''}`}>
                  {format(day, isMobile ? 'EEE, MMM d' : 'EEE d')}
                </CardTitle>
              </CardHeader>
              <Separator />
              <CardContent className="p-2">
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {/* All-Day Events (Projects) */}
                    {allDayEvents.map((event) => (
                      <div
                        key={`project-${event.id}`}
                        className={`${getEventColor(event.progress, 'project')} p-2 rounded text-white text-sm`}
                      >
                        <div className="flex items-center gap-1 font-medium">
                          <FolderOpen className="h-3 w-3" />
                          <span className="truncate">{event.name}</span>
                        </div>
                        <div className="text-xs mt-1 opacity-90">Due Today</div>
                      </div>
                    ))}
                    
                    {/* Timed Events (Tasks) */}
                    {timedEvents.map((event) => (
                      <div
                        key={`task-${event.id}`}
                        className={`${getEventColor(event.progress, 'task')} p-2 rounded text-white text-sm`}
                      >
                        <div className="font-medium truncate">{event.name}</div>
                        <div className="text-xs mt-1 opacity-90">
                          {event.date_started && format(new Date(event.date_started), 'h:mm a')}
                        </div>
                      </div>
                    ))}
                    
                    {dayEvents.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        No events
                      </div>
                    )}
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
