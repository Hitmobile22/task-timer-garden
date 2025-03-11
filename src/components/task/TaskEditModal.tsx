
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Task } from "@/types/task.types";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { RichTextEditor } from './editor/RichTextEditor';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TaskEditModalProps {
  task: Task;
  taskLists: any[];
  isOpen: boolean;
  onClose: () => void;
  onEditNameChange: (value: string) => void;
  onUpdateProgress: (taskId: number, progress: Task['Progress']) => void;
  onMoveTask: (taskId: number, listId: number) => void;
  onTimelineEdit: (taskId: number, start: Date, end: Date) => void;
}

interface EditorContent {
  type: string;
  content: { type: string; content: { type: string; text: string; }[] }[];
}

export const TaskEditModal: React.FC<TaskEditModalProps> = ({
  task,
  taskLists,
  isOpen,
  onClose,
  onEditNameChange,
  onUpdateProgress,
  onMoveTask,
  onTimelineEdit,
}) => {
  const [taskName, setTaskName] = React.useState<string>("");
  const [tempProgress, setTempProgress] = React.useState<Task['Progress']>("Not started");
  const [tempListId, setTempListId] = React.useState<number>(1);
  const [selectedStartDate, setSelectedStartDate] = React.useState<Date>(new Date());
  const [selectedEndDate, setSelectedEndDate] = React.useState<Date>(new Date());
  const [details, setDetails] = React.useState<EditorContent>({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
  });
  const [startDateOpen, setStartDateOpen] = React.useState(false);
  const [endDateOpen, setEndDateOpen] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && task) {
      setTaskName(task["Task Name"] || "");
      setTempProgress(task.Progress || "Not started");
      setTempListId(task.task_list_id || 1);
      setSelectedStartDate(task.date_started ? new Date(task.date_started) : new Date());
      setSelectedEndDate(task.date_due ? new Date(task.date_due) : new Date(Date.now() + 25 * 60 * 1000));
      
      // Check if details exists and if it contains rich text editor content
      if (task.details) {
        if (typeof task.details === 'object' && task.details !== null) {
          if (task.details.type && task.details.content) {
            // It's rich text editor content
            setDetails(task.details as unknown as EditorContent);
          } else {
            // It's other details, but we still need to initialize the editor
            setDetails({
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
            });
          }
        } else {
          // No details, initialize with empty editor content
          setDetails({
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
          });
        }
      } else {
        // No details, initialize with empty editor content
        setDetails({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
        });
      }
    }
  }, [isOpen, task]);

  const handleSave = async () => {
    if (!taskName?.trim()) {
      toast.error("Task name cannot be empty");
      return;
    }

    onEditNameChange(taskName);
    onUpdateProgress(task.id, tempProgress);
    onMoveTask(task.id, tempListId);
    onTimelineEdit(task.id, selectedStartDate, selectedEndDate);
    
    // Prepare details for update
    const updatedDetails: Record<string, any> = {
      ...(typeof details === 'object' ? details : {}),
    };
    
    // Preserve isTimeBlock flag if it exists
    if (task.details) {
      // Handle object details
      if (typeof task.details === 'object' && task.details !== null) {
        if (task.details.hasOwnProperty('isTimeBlock')) {
          updatedDetails.isTimeBlock = task.details.isTimeBlock;
        }
      }
      // Handle string details that might contain JSON
      else if (typeof task.details === 'string') {
        try {
          const parsedDetails = JSON.parse(task.details);
          if (parsedDetails && parsedDetails.hasOwnProperty('isTimeBlock')) {
            updatedDetails.isTimeBlock = parsedDetails.isTimeBlock;
          }
        } catch (e) {
          // Not valid JSON, ignore
        }
      }
    }
    
    try {
      await supabase
        .from('Tasks')
        .update({ details: updatedDetails })
        .eq('id', task.id);
      
      onClose();
      toast.success("Task updated successfully");
    } catch (error) {
      console.error('Error updating task details:', error);
      toast.error("Failed to update task details");
    }
  };

  const formatDateTime = (date: Date) => {
    return format(date, 'M/d h:mm a');
  };

  // Prevent event propagation completely for the calendar and its container
  const preventPropagation = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]" onClick={preventPropagation}>
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Task Name</label>
            <Input
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              className="w-full"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Progress</label>
              <Select
                value={tempProgress}
                onValueChange={(value: Task['Progress']) => setTempProgress(value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select progress" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Not started">Not started</SelectItem>
                  <SelectItem value="In progress">In progress</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Backlog">Backlog</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">List</label>
              <Select
                value={String(tempListId)}
                onValueChange={(value) => setTempListId(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select list" />
                </SelectTrigger>
                <SelectContent>
                  {taskLists?.map((list) => (
                    <SelectItem key={list.id} value={String(list.id)}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Timeline</label>
            <div className="flex gap-2">
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedStartDate && "text-muted-foreground"
                    )}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {selectedStartDate ? formatDateTime(selectedStartDate) : <span>Start time</span>}
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
                  <div onKeyDown={preventPropagation} onClick={preventPropagation}>
                    <Calendar
                      mode="single"
                      selected={selectedStartDate}
                      onSelect={(date) => date && setSelectedStartDate(date)}
                      initialFocus
                    />
                    <div className="border-t p-3">
                      <Input
                        type="time"
                        value={format(selectedStartDate, "HH:mm")}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':');
                          const newDate = new Date(selectedStartDate);
                          newDate.setHours(parseInt(hours));
                          newDate.setMinutes(parseInt(minutes));
                          setSelectedStartDate(newDate);
                        }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedEndDate && "text-muted-foreground"
                    )}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    {selectedEndDate ? formatDateTime(selectedEndDate) : <span>End time</span>}
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
                  <div onKeyDown={preventPropagation} onClick={preventPropagation}>
                    <Calendar
                      mode="single"
                      selected={selectedEndDate}
                      onSelect={(date) => date && setSelectedEndDate(date)}
                      initialFocus
                    />
                    <div className="border-t p-3">
                      <Input
                        type="time"
                        value={format(selectedEndDate, "HH:mm")}
                        onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':');
                          const newDate = new Date(selectedEndDate);
                          newDate.setHours(parseInt(hours));
                          newDate.setMinutes(parseInt(minutes));
                          setSelectedEndDate(newDate);
                        }}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Details</label>
            <RichTextEditor content={details} onChange={setDetails} />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
