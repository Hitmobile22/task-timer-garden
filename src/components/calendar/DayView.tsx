
import React from 'react';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { Task } from '@/pages/Calendar';

interface DayViewProps {
  date: Date;
  tasks: Task[] | undefined;
  getTasksForDay: (date: Date) => Task[];
  getTaskColor: (progress: Task['Progress']) => string;
}

export const DayView: React.FC<DayViewProps> = ({ 
  date, 
  getTasksForDay,
  getTaskColor
}) => (
  <div className="relative h-[calc(100vh-300px)] overflow-auto">
    <div className="sticky top-0 bg-background z-10 py-2 mb-4">
      <h2 className="text-lg font-semibold">
        {format(date, 'EEEE, MMMM d')}
      </h2>
    </div>
    <div className="space-y-2">
      {getTasksForDay(date).map((task) => (
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
