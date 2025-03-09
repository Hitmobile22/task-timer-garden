
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TimeBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTimeBlock: (timeBlock: {name: string, startDate: Date, duration: number}) => void;
}

export const TimeBlockModal: React.FC<TimeBlockModalProps> = ({
  isOpen,
  onClose,
  onCreateTimeBlock
}) => {
  const [name, setName] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [duration, setDuration] = useState<string>("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  const durationOptions = [
    { value: "10", label: "10 minutes" },
    { value: "20", label: "20 minutes" },
    { value: "30", label: "30 minutes" },
    { value: "60", label: "1 hour" },
    { value: "120", label: "2 hours" },
    { value: "180", label: "3 hours" },
    { value: "240", label: "4 hours" },
  ];
  
  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }
    
    if (!selectedDate) {
      return;
    }
    
    if (!duration) {
      return;
    }
    
    onCreateTimeBlock({
      name: name.trim(),
      startDate: selectedDate,
      duration: parseInt(duration)
    });
    
    // Reset form
    setName("");
    setSelectedDate(new Date());
    setDuration("");
    onClose();
  };
  
  // Function to prevent event propagation
  const handlePopoverInteraction = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Add Time Block</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="time-block-name">Time Block Name</Label>
            <Input
              id="time-block-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Meeting with team"
            />
          </div>
          
          <div className="grid gap-2">
            <Label>Schedule for</Label>
            <Popover
              open={calendarOpen}
              onOpenChange={setCalendarOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP p") : <span>Pick date and time</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0" 
                align="start"
                onInteractOutside={(e) => e.preventDefault()}
                onOpenAutoFocus={(e) => e.preventDefault()}
                onFocusOutside={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                <div 
                  className="p-4 space-y-4"
                  onClick={handlePopoverInteraction}
                  onKeyDown={handlePopoverInteraction}
                >
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        const currentTime = selectedDate || new Date();
                        date.setHours(currentTime.getHours());
                        date.setMinutes(currentTime.getMinutes());
                        setSelectedDate(date);
                      }
                    }}
                    initialFocus
                  />
                  <div className="flex gap-2 items-center">
                    <Input
                      type="time"
                      value={selectedDate ? format(selectedDate, "HH:mm") : ""}
                      onChange={(e) => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const newDate = new Date(selectedDate);
                        newDate.setHours(hours);
                        newDate.setMinutes(minutes);
                        setSelectedDate(newDate);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="duration">Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {durationOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Create Time Block</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
