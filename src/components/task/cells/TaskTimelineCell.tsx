
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Clock, LockIcon } from "lucide-react";

interface TaskTimelineCellProps {
  startDate?: Date;
  endDate?: Date;
  isEditing: boolean;
  onTimelineUpdate: (startDate?: Date, endDate?: Date) => void;
  isTimeBlock?: boolean;
}

export const TaskTimelineCell: React.FC<TaskTimelineCellProps> = ({
  startDate,
  endDate,
  isEditing,
  onTimelineUpdate,
  isTimeBlock = false,
}) => {
  const [startCalendarOpen, setStartCalendarOpen] = React.useState(false);
  const [endCalendarOpen, setEndCalendarOpen] = React.useState(false);
  const [localStartDate, setLocalStartDate] = React.useState<Date | undefined>(startDate);
  const [localEndDate, setLocalEndDate] = React.useState<Date | undefined>(endDate);

  React.useEffect(() => {
    setLocalStartDate(startDate);
    setLocalEndDate(endDate);
  }, [startDate, endDate, isEditing]);

  const handleStartDateChange = (date?: Date) => {
    if (!date || isTimeBlock) return;
    
    // Get time from current start date
    const newDate = new Date(date);
    if (localStartDate) {
      newDate.setHours(localStartDate.getHours());
      newDate.setMinutes(localStartDate.getMinutes());
    }
    
    setLocalStartDate(newDate);
    onTimelineUpdate(newDate, localEndDate);
  };

  const handleEndDateChange = (date?: Date) => {
    if (!date || isTimeBlock) return;
    
    // Get time from current end date
    const newDate = new Date(date);
    if (localEndDate) {
      newDate.setHours(localEndDate.getHours());
      newDate.setMinutes(localEndDate.getMinutes());
    }
    
    setLocalEndDate(newDate);
    onTimelineUpdate(localStartDate, newDate);
  };

  const handleStartTimeChange = (time: string) => {
    if (!localStartDate || isTimeBlock) return;
    
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(localStartDate);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    
    setLocalStartDate(newDate);
    onTimelineUpdate(newDate, localEndDate);
  };

  const handleEndTimeChange = (time: string) => {
    if (!localEndDate || isTimeBlock) return;
    
    const [hours, minutes] = time.split(':').map(Number);
    const newDate = new Date(localEndDate);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    
    setLocalEndDate(newDate);
    onTimelineUpdate(localStartDate, newDate);
  };

  const formatTime = (date?: Date) => {
    if (!date) return "Not set";
    return format(date, "h:mm a");
  };

  const formatDate = (date?: Date) => {
    if (!date) return "Not set";
    return format(date, "MMM d");
  };

  return (
    <TableCell>
      {isEditing ? (
        <div className="flex space-x-2">
          {isTimeBlock ? (
            <div className="flex flex-col space-y-1 w-full">
              <div className="flex items-center text-amber-600 text-xs mb-2">
                <LockIcon className="h-3 w-3 mr-1" />
                <span>Time blocks have fixed schedule</span>
              </div>
              <div className="flex items-center space-x-2 h-10 px-3 py-2 border rounded-md">
                <LockIcon className="h-4 w-4 text-amber-500" />
                <div className="text-sm">
                  {formatDate(localStartDate)}, {formatTime(localStartDate)}
                </div>
              </div>
              <div className="flex items-center space-x-2 h-10 px-3 py-2 border rounded-md">
                <LockIcon className="h-4 w-4 text-amber-500" />
                <div className="text-sm">
                  {formatDate(localEndDate)}, {formatTime(localEndDate)}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col space-y-1 w-full">
              <div className="flex space-x-2">
                <Popover open={startCalendarOpen} onOpenChange={setStartCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Clock className="mr-2 h-4 w-4" />
                      {formatDate(localStartDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={localStartDate}
                      onSelect={handleStartDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={localStartDate ? format(localStartDate, "HH:mm") : ""}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  className="w-24"
                />
              </div>
              <div className="flex space-x-2">
                <Popover open={endCalendarOpen} onOpenChange={setEndCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Clock className="mr-2 h-4 w-4" />
                      {formatDate(localEndDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={localEndDate}
                      onSelect={handleEndDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <Input
                  type="time"
                  value={localEndDate ? format(localEndDate, "HH:mm") : ""}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  className="w-24"
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-sm space-y-1">
          {isTimeBlock && (
            <div className="flex items-center text-amber-600 text-xs mb-1">
              <LockIcon className="h-3 w-3 mr-1" />
              <span>Fixed</span>
            </div>
          )}
          <div className="flex items-center">
            <Clock className="mr-2 h-3 w-3 text-gray-400" />
            <span>{startDate ? format(startDate, "MMM d, h:mm a") : "Not set"}</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-2 h-3 w-3 text-gray-400" />
            <span>{endDate ? format(endDate, "MMM d, h:mm a") : "Not set"}</span>
          </div>
        </div>
      )}
    </TableCell>
  );
};
