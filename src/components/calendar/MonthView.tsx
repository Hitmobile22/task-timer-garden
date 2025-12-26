import React from 'react';
import { format, startOfMonth, getDaysInMonth, isSameDay, addDays } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderOpen } from "lucide-react";
import { CalendarEvent } from '@/types/calendar.types';
import { getEventColor } from './CalendarUtils';

interface MonthViewProps {
  date: Date;
  isMobile: boolean;
  getEventsForDay: (date: Date) => CalendarEvent[];
}

export const MonthView: React.FC<MonthViewProps> = ({ 
  date, 
  isMobile, 
  getEventsForDay
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
          const dayEvents = getEventsForDay(day);
          const allDayEvents = dayEvents.filter(e => e.isAllDay);
          const timedEvents = dayEvents.filter(e => !e.isAllDay);
          const isToday = isSameDay(day, new Date());

          return (
            <Card 
              key={day.toString()} 
              className={`min-h-[120px] ${isToday ? 'border-primary ring-1 ring-primary/20' : ''}`}
            >
              <CardHeader className="p-2">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-sm ${isToday ? 'text-primary font-bold' : ''}`}>
                    {format(day, isMobile ? 'EEE, MMM d' : 'd')}
                  </CardTitle>
                  {dayEvents.length > 0 && (
                    <div className="flex items-center gap-1">
                      {allDayEvents.length > 0 && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">
                          {allDayEvents.length}📁
                        </span>
                      )}
                      {timedEvents.length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                          {timedEvents.length}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[80px]">
                  <div className="space-y-1">
                    {/* All-Day Events (Projects) first */}
                    {allDayEvents.map((event) => (
                      <div
                        key={`project-${event.id}`}
                        className={`${getEventColor(event.progress, 'project')} p-1.5 rounded text-white text-xs flex items-center gap-1`}
                      >
                        <FolderOpen className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{event.name}</span>
                      </div>
                    ))}
                    
                    {/* Timed Events (Tasks) */}
                    {timedEvents.map((event) => (
                      <div
                        key={`task-${event.id}`}
                        className={`${getEventColor(event.progress, 'task')} p-1.5 rounded text-white text-xs truncate`}
                      >
                        {event.name}
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
