
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
  const [tempStartDate, setTempStartDate] = React.useState<Date | undefined>(selectedStartDate);
  const [tempEndDate, setTempEndDate] = React.useState<Date | undefined>(selectedEndDate);
  const [startDateOpen, setStartDateOpen] = React.useState(false);
  const [endDateOpen, setEndDateOpen] = React.useState(false);

  React.useEffect(() => {
    if (tempStartDate !== selectedStartDate || tempEndDate !== selectedEndDate) {
      onTimelineUpdate(tempStartDate, tempEndDate);
    }
  }, [tempStartDate, tempEndDate]);

  React.useEffect(() => {
    setTempStartDate(selectedStartDate);
    setTempEndDate(selectedEndDate);
  }, [selectedStartDate, selectedEndDate]);

  const formatDateTime = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, 'M/d h:mm a');
  };

  // Prevent event bubbling to dialog
  const handlePopoverClick = (e: React.MouseEvent) => {
    e.stopPropagation();
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
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  !tempStartDate && "text-muted-foreground"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Clock className="mr-2 h-4 w-4" />
                {tempStartDate ? formatDateTime(tempStartDate) : (
                  <span>Start time</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" onClick={handlePopoverClick}>
              <Calendar
                mode="single"
                selected={tempStartDate}
                onSelect={(date) => {
                  if (date) {
                    const newDate = new Date(date);
                    if (tempStartDate) {
                      newDate.setHours(tempStartDate.getHours());
                      newDate.setMinutes(tempStartDate.getMinutes());
                    } else {
                      newDate.setHours(new Date().getHours());
                      newDate.setMinutes(new Date().getMinutes());
                    }
                    setTempStartDate(newDate);
                    setStartDateOpen(false);
                  }
                }}
                initialFocus
              />
              <div className="border-t p-3" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="time"
                  value={tempStartDate ? format(tempStartDate, "HH:mm") : ""}
                  onChange={(e) => {
                    if (tempStartDate && e.target.value) {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(tempStartDate);
                      newDate.setHours(parseInt(hours));
                      newDate.setMinutes(parseInt(minutes));
                      setTempStartDate(newDate);
                    }
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-[140px] justify-start text-left font-normal",
                  !tempEndDate && "text-muted-foreground"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <Clock className="mr-2 h-4 w-4" />
                {tempEndDate ? formatDateTime(tempEndDate) : (
                  <span>Due time</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" onClick={handlePopoverClick}>
              <Calendar
                mode="single"
                selected={tempEndDate}
                onSelect={(date) => {
                  if (date) {
                    const newDate = new Date(date);
                    if (tempEndDate) {
                      newDate.setHours(tempEndDate.getHours());
                      newDate.setMinutes(tempEndDate.getMinutes());
                    } else {
                      newDate.setHours(new Date().getHours());
                      newDate.setMinutes(new Date().getMinutes());
                    }
                    setTempEndDate(newDate);
                    setEndDateOpen(false);
                  }
                }}
                initialFocus
              />
              <div className="border-t p-3" onClick={(e) => e.stopPropagation()}>
                <Input
                  type="time"
                  value={tempEndDate ? format(tempEndDate, "HH:mm") : ""}
                  onChange={(e) => {
                    if (tempEndDate && e.target.value) {
                      const [hours, minutes] = e.target.value.split(':');
                      const newDate = new Date(tempEndDate);
                      newDate.setHours(parseInt(hours));
                      newDate.setMinutes(parseInt(minutes));
                      setTempEndDate(newDate);
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
