import React from 'react';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock, FolderOpen } from "lucide-react";
import { CalendarEvent } from '@/types/calendar.types';
import { getEventColor } from './CalendarUtils';

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
}

export const DayView: React.FC<DayViewProps> = ({ date, events }) => {
  const allDayEvents = events.filter(e => e.isAllDay);
  const timedEvents = events.filter(e => !e.isAllDay);

  return (
    <div className="relative h-[calc(100vh-300px)] overflow-auto">
      <div className="sticky top-0 bg-background z-10 py-2 mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          {format(date, 'EEEE, MMMM d')}
        </h2>
      </div>
      
      {/* All-Day Events Section (Projects) */}
      {allDayEvents.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">All Day</h3>
          <div className="space-y-2">
            {allDayEvents.map((event) => (
              <Card key={`project-${event.id}`} className="border border-border">
                <CardHeader className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-violet-500" />
                      <CardTitle className="text-base">{event.name}</CardTitle>
                    </div>
                    <div className={`${getEventColor(event.progress, 'project')} px-2 py-1 rounded text-xs text-white`}>
                      Due Today
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}
      
      {/* Timed Events Section (Tasks) */}
      <div className="space-y-2">
        {timedEvents.length > 0 ? (
          <>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Tasks</h3>
            {timedEvents.map((event) => (
              <Card key={`task-${event.id}`} className="border border-border">
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{event.name}</CardTitle>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" />
                        {event.date_started && format(new Date(event.date_started), 'h:mm a')} 
                        {event.date_due && ` - ${format(new Date(event.date_due), 'h:mm a')}`}
                      </div>
                    </div>
                    <div className={`${getEventColor(event.progress, 'task')} px-2 py-1 rounded text-xs text-white`}>
                      {event.progress}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </>
        ) : allDayEvents.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No events scheduled for this day
          </div>
        ) : null}
      </div>
    </div>
  );
};
