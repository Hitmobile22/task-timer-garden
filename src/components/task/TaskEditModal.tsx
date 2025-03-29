
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
import { format, addDays, isEqual } from "date-fns";
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
  const [taskInitialized, setTaskInitialized] = React.useState(false);

  // Store the original values for comparison before saving
  const [originalTaskName, setOriginalTaskName] = React.useState<string>("");
  const [originalProgress, setOriginalProgress] = React.useState<Task['Progress']>("Not started");
  const [originalListId, setOriginalListId] = React.useState<number>(1);
  const [originalStartDate, setOriginalStartDate] = React.useState<Date | null>(null);
  const [originalEndDate, setOriginalEndDate] = React.useState<Date | null>(null);
  const [originalDetails, setOriginalDetails] = React.useState<any>(null);

  const initializeTaskForm = React.useCallback(() => {
    if (task) {
      console.log("TaskEditModal: Initializing task form with data:", task);
      const taskNameValue = task["Task Name"] || "";
      const progressValue = task.Progress || "Not started";
      const listIdValue = task.task_list_id || 1;
      const startDateValue = task.date_started ? new Date(task.date_started) : new Date();
      const endDateValue = task.date_due ? new Date(task.date_due) : new Date(Date.now() + 25 * 60 * 1000);
      
      // Set current values
      setTaskName(taskNameValue);
      setTempProgress(progressValue);
      setTempListId(listIdValue);
      setSelectedStartDate(startDateValue);
      setSelectedEndDate(endDateValue);
      
      // Store original values for comparison
      setOriginalTaskName(taskNameValue);
      setOriginalProgress(progressValue);
      setOriginalListId(listIdValue);
      setOriginalStartDate(startDateValue);
      setOriginalEndDate(endDateValue);
      
      if (task.details) {
        try {
          let parsedDetails;
          if (typeof task.details === 'string') {
            try {
              parsedDetails = JSON.parse(task.details);
              if (parsedDetails && typeof parsedDetails === 'object' && 'type' in parsedDetails && 'content' in parsedDetails) {
                setDetails(parsedDetails as EditorContent);
                setOriginalDetails(JSON.stringify(parsedDetails));
              } else {
                const defaultDetails = {
                  type: 'doc',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
                };
                setDetails(defaultDetails);
                setOriginalDetails(JSON.stringify(defaultDetails));
              }
            } catch {
              const textDetails = {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: task.details }] }]
              };
              setDetails(textDetails);
              setOriginalDetails(JSON.stringify(textDetails));
            }
          } else if (typeof task.details === 'object' && task.details !== null) {
            if ('type' in task.details && 'content' in task.details) {
              setDetails(task.details as unknown as EditorContent);
              setOriginalDetails(JSON.stringify(task.details));
            } else {
              const defaultDetails = {
                type: 'doc',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
              };
              setDetails(defaultDetails);
              setOriginalDetails(JSON.stringify(defaultDetails));
            }
          } else {
            const defaultDetails = {
              type: 'doc',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
            };
            setDetails(defaultDetails);
            setOriginalDetails(JSON.stringify(defaultDetails));
          }
        } catch (e) {
          console.error("Error parsing task details:", e);
          const defaultDetails = {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
          };
          setDetails(defaultDetails);
          setOriginalDetails(JSON.stringify(defaultDetails));
        }
      } else {
        const defaultDetails = {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
        };
        setDetails(defaultDetails);
        setOriginalDetails(JSON.stringify(defaultDetails));
      }
      
      setTaskInitialized(true);
    }
  }, [task]);

  React.useEffect(() => {
    if (isOpen && task) {
      console.log("TaskEditModal: Modal opened with task ID:", task.id);
      initializeTaskForm();
    } else if (!isOpen) {
      setTaskInitialized(false);
    }
  }, [isOpen, task, initializeTaskForm]);

  const handleSave = async () => {
    if (!taskName?.trim()) {
      toast.error("Task name cannot be empty");
      return;
    }

    console.log("TaskEditModal: Saving task with name:", taskName);
    
    let updatesApplied = false;
    
    // Only update name if it changed
    if (taskName !== originalTaskName) {
      onEditNameChange(taskName);
      updatesApplied = true;
      toast.success("Task name updated");
    }
    
    // Only update progress if it changed
    if (tempProgress !== originalProgress) {
      onUpdateProgress(task.id, tempProgress);
      updatesApplied = true;
      toast.success("Task progress updated");
    }
    
    // Only update list if it changed
    if (tempListId !== originalListId) {
      onMoveTask(task.id, tempListId);
      updatesApplied = true;
      toast.success("Task moved to new list");
    }
    
    // Check if dates have changed using date-fns isEqual
    const startDateChanged = !originalStartDate || !selectedStartDate || 
      !isEqual(new Date(originalStartDate), new Date(selectedStartDate));
    
    const endDateChanged = !originalEndDate || !selectedEndDate || 
      !isEqual(new Date(originalEndDate), new Date(selectedEndDate));
    
    // Only update timeline if either date changed
    if (startDateChanged || endDateChanged) {
      onTimelineEdit(task.id, selectedStartDate, selectedEndDate);
      updatesApplied = true;
      toast.success("Task timeline updated");
    }
    
    // Check if details have changed
    const currentDetailsString = JSON.stringify(details);
    const detailsChanged = currentDetailsString !== originalDetails;
    
    // Handle details update
    const updatedDetails: Record<string, any> = {
      ...(typeof details === 'object' ? details : {}),
    };
    
    let isTimeBlock = false;
    
    if (task.details) {
      if (typeof task.details === 'object' && task.details !== null) {
        if ('isTimeBlock' in task.details && typeof task.details.isTimeBlock === 'boolean') {
          isTimeBlock = task.details.isTimeBlock;
        }
      } else if (typeof task.details === 'string') {
        try {
          const parsedDetails = JSON.parse(task.details);
          if (parsedDetails && typeof parsedDetails === 'object' && 'isTimeBlock' in parsedDetails) {
            isTimeBlock = Boolean(parsedDetails.isTimeBlock);
          }
        } catch (e) {
          // Keep isTimeBlock as false on parse error
        }
      }
    }
    
    updatedDetails.isTimeBlock = isTimeBlock;
    
    try {
      if (detailsChanged) {
        await supabase
          .from('Tasks')
          .update({ details: updatedDetails })
          .eq('id', task.id);
        
        updatesApplied = true;
        toast.success("Task details updated");
      }
      
      if (!updatesApplied) {
        toast.info("No changes to save");
      }
      
      onClose();
    } catch (error) {
      console.error('Error updating task details:', error);
      toast.error("Failed to update task details");
    }
  };

  const handlePushTask = () => {
    const nextDayStart = addDays(selectedStartDate, 1);
    const nextDayEnd = addDays(selectedEndDate, 1);
    
    setSelectedStartDate(nextDayStart);
    setSelectedEndDate(nextDayEnd);
    
    toast.info("Task scheduled for tomorrow");
  };

  const formatDateTime = (date: Date) => {
    return format(date, 'M/d h:mm a');
  };

  const preventPropagation = (e: React.MouseEvent | React.KeyboardEvent | React.TouchEvent) => {
    e.stopPropagation();
  };
  
  const handleInteractOutside = (event: any) => {
    event.preventDefault();
  };
  
  const handleOpenAutoFocus = (event: Event) => {
    event.preventDefault();
  };
  
  const handlePointerDownOutside = (event: any) => {
    event.preventDefault();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" onClick={preventPropagation}>
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        {taskInitialized && (
          <div className="flex flex-col gap-4 py-2 overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium">Task Name</label>
              <Input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className="w-full"
                onClick={preventPropagation}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Progress</label>
                <Select
                  value={tempProgress}
                  onValueChange={(value: Task['Progress']) => setTempProgress(value)}
                >
                  <SelectTrigger className="w-full" onClick={preventPropagation}>
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
                  <SelectTrigger className="w-full" onClick={preventPropagation}>
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
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedStartDate && "text-muted-foreground"
                      )}
                      onClick={preventPropagation}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {selectedStartDate ? formatDateTime(selectedStartDate) : <span>Start time</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-0" 
                    align="start"
                    onInteractOutside={handleInteractOutside}
                    onOpenAutoFocus={handleOpenAutoFocus}
                    onPointerDownOutside={handlePointerDownOutside}
                  >
                    <div onKeyDown={preventPropagation} onClick={preventPropagation}>
                      <Calendar
                        mode="single"
                        selected={selectedStartDate}
                        onSelect={(date) => date && setSelectedStartDate(date)}
                        initialFocus
                        className="pointer-events-auto"
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
                          onClick={preventPropagation}
                          onTouchStart={preventPropagation}
                          onMouseDown={preventPropagation}
                          className="pointer-events-auto z-[60]"
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
                      onClick={preventPropagation}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {selectedEndDate ? formatDateTime(selectedEndDate) : <span>End time</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-auto p-0" 
                    align="start"
                    onInteractOutside={handleInteractOutside}
                    onOpenAutoFocus={handleOpenAutoFocus}
                    onPointerDownOutside={handlePointerDownOutside}
                  >
                    <div onKeyDown={preventPropagation} onClick={preventPropagation}>
                      <Calendar
                        mode="single"
                        selected={selectedEndDate}
                        onSelect={(date) => date && setSelectedEndDate(date)}
                        initialFocus
                        className="pointer-events-auto"
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
                          onClick={preventPropagation}
                          onTouchStart={preventPropagation}
                          onMouseDown={preventPropagation}
                          className="pointer-events-auto z-[60]"
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Details</label>
              <div className="min-h-[150px] max-h-[250px] overflow-y-auto border rounded-md">
                <RichTextEditor content={details} onChange={setDetails} />
              </div>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4 pt-2 border-t sticky bottom-0 bg-background">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="secondary" onClick={handlePushTask}>Push task</Button>
          <Button onClick={handleSave}>Save changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
