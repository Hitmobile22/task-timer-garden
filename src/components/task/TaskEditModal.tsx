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
  const [taskName, setTaskName] = React.useState(task["Task Name"]);
  const [selectedStartDate, setSelectedStartDate] = React.useState<Date>(
    task.date_started ? new Date(task.date_started) : new Date()
  );
  const [selectedEndDate, setSelectedEndDate] = React.useState<Date>(
    task.date_due ? new Date(task.date_due) : new Date(Date.now() + 25 * 60 * 1000)
  );
  const [details, setDetails] = React.useState(task.details || {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }]
  });

  const handleSave = async () => {
    onEditNameChange(taskName);
    onTimelineEdit(task.id, selectedStartDate, selectedEndDate);
    
    try {
      await supabase
        .from('Tasks')
        .update({ details })
        .eq('id', task.id);
    } catch (error) {
      console.error('Error updating task details:', error);
    }
    
    onClose();
  };

  const formatDateTime = (date: Date) => {
    return format(date, 'M/d h:mm a');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
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
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Progress</label>
            <Select
              value={task.Progress}
              onValueChange={(value: Task['Progress']) => onUpdateProgress(task.id, value)}
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
              value={String(task.task_list_id)}
              onValueChange={(value) => onMoveTask(task.id, Number(value))}
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Timeline</label>
            <div className="flex gap-2">
              <Popover>
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
                <PopoverContent className="w-auto p-0" align="start">
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
                </PopoverContent>
              </Popover>

              <Popover>
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
                <PopoverContent className="w-auto p-0" align="start">
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
