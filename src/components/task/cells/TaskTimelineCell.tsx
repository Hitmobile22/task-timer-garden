
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Clock } from "lucide-react";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskTimelineCellProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  isEditing: boolean;
  onTimelineUpdate: (startDate?: Date, endDate?: Date) => void;
}

export const TaskTimelineCell: React.FC<TaskTimelineCellProps> = ({
  startDate: selectedStartDate,
  endDate: selectedEndDate,
  isEditing,
  onTimelineUpdate,
}) => {
  const formatDateTime = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, 'M/d h:mm a');
  };

  if (!isEditing) {
    return (
      <TableCell>
        <div className="space-y-1">
          <div className="text-sm">
            Start: {selectedStartDate ? formatDateTime(selectedStartDate) : 'Not set'}
          </div>
          <div className="text-sm">
            Due: {selectedEndDate ? formatDateTime(selectedEndDate) : 'Not set'}
          </div>
        </div>
      </TableCell>
    );
  }

  return (
    <TableCell>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  !selectedStartDate && "text-muted-foreground"
                )}
              >
                <Clock className="mr-2 h-4 w-4" />
                {selectedStartDate ? formatDateTime(selectedStartDate) : (
                  <span>Start time</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedStartDate}
                onSelect={(date) => {
                  if (date) {
                    const newDate = new Date(date);
                    if (selectedStartDate) {
                      newDate.setHours(selectedStartDate.getHours());
                      newDate.setMinutes(selectedStartDate.getMinutes());
                    } else {
                      newDate.setHours(new Date().getHours());
                      newDate.setMinutes(new Date().getMinutes());
                    }
                    onTimelineUpdate(newDate, selectedEndDate);
                  }
                }}
                initialFocus
              />
              <div className="border-t p-3">
                <Input
                  type="time"
                  value={selectedStartDate ? format(selectedStartDate, "HH:mm") : ""}
                  onChange={(e) => {
                    if (selectedStartDate && e.target.value) {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(selectedStartDate);
                      newDate.setHours(parseInt(hours));
                      newDate.setMinutes(parseInt(minutes));
                      onTimelineUpdate(newDate, selectedEndDate);
                    }
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  !selectedEndDate && "text-muted-foreground"
                )}
              >
                <Clock className="mr-2 h-4 w-4" />
                {selectedEndDate ? formatDateTime(selectedEndDate) : (
                  <span>Due time</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedEndDate}
                onSelect={(date) => {
                  if (date) {
                    const newDate = new Date(date);
                    if (selectedEndDate) {
                      newDate.setHours(selectedEndDate.getHours());
                      newDate.setMinutes(selectedEndDate.getMinutes());
                    } else {
                      newDate.setHours(new Date().getHours());
                      newDate.setMinutes(new Date().getMinutes());
                    }
                    onTimelineUpdate(selectedStartDate, newDate);
                  }
                }}
                initialFocus
              />
              <div className="border-t p-3">
                <Input
                  type="time"
                  value={selectedEndDate ? format(selectedEndDate, "HH:mm") : ""}
                  onChange={(e) => {
                    if (selectedEndDate && e.target.value) {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(selectedEndDate);
                      newDate.setHours(parseInt(hours));
                      newDate.setMinutes(parseInt(minutes));
                      onTimelineUpdate(selectedStartDate, newDate);
                    }
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </TableCell>
  );
};
