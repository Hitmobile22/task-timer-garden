
import React, { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Task } from '@/types/task.types';

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (projectData: any) => void;
  taskLists: any[];
  availableTasks: Task[];
  initialData?: {
    id?: number;
    name: string;
    startDate?: Date;
    dueDate?: Date;
    status: string;
    taskListId?: number;
    selectedTasks?: number[];
    isRecurring?: boolean;
    recurringTaskCount?: number;
  };
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  onClose,
  onSubmit,
  taskLists,
  availableTasks,
  initialData,
}) => {
  const [name, setName] = React.useState(initialData?.name || "");
  const [selectedTasks, setSelectedTasks] = React.useState<number[]>(initialData?.selectedTasks || []);
  const [startDate, setStartDate] = React.useState<Date | undefined>(initialData?.startDate);
  const [dueDate, setDueDate] = React.useState<Date | undefined>(initialData?.dueDate);
  const [status, setStatus] = React.useState(initialData?.status || "Not started");
  const [taskListId, setTaskListId] = React.useState(initialData?.taskListId?.toString() || "");
  const [isRecurring, setIsRecurring] = React.useState(initialData?.isRecurring || false);
  const [recurringTaskCount, setRecurringTaskCount] = React.useState(initialData?.recurringTaskCount || 1);
  const [startDateOpen, setStartDateOpen] = React.useState(false);
  const [dueDateOpen, setDueDateOpen] = React.useState(false);

  // Update form state when initialData changes
  useEffect(() => {
    if (initialData) {
      console.log("ProjectModal: Updating form with initialData:", initialData);
      setName(initialData.name || "");
      setSelectedTasks(initialData.selectedTasks || []);
      setStartDate(initialData.startDate);
      setDueDate(initialData.dueDate);
      setStatus(initialData.status || "Not started");
      setTaskListId(initialData.taskListId?.toString() || "");
      setIsRecurring(initialData.isRecurring || false);
      setRecurringTaskCount(initialData.recurringTaskCount || 1);
    } else {
      // Reset form for new project
      handleReset();
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log("ProjectModal: Submitting form with data:", {
      id: initialData?.id,
      name,
      selectedTasks,
      startDate,
      dueDate,
      status,
      taskListId: taskListId ? parseInt(taskListId) : undefined,
      isRecurring,
      recurringTaskCount,
    });
    
    onSubmit({
      id: initialData?.id,
      name,
      selectedTasks,
      startDate,
      dueDate,
      status,
      taskListId: taskListId ? parseInt(taskListId) : undefined,
      isRecurring,
      recurringTaskCount,
    });
  };

  const handleReset = () => {
    setName("");
    setSelectedTasks([]);
    setStartDate(undefined);
    setDueDate(undefined);
    setStatus("Not started");
    setTaskListId("");
    setIsRecurring(false);
    setRecurringTaskCount(1);
  };

  // Prevent event propagation completely for the calendar and its container
  const preventPropagation = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]" onClick={preventPropagation}>
        <DialogHeader>
          <DialogTitle>{initialData?.id ? 'Edit Project' : 'Create New Project'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tasks</label>
            <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-2">
              {availableTasks.map((task) => (
                <div key={task.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={selectedTasks.includes(task.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTasks([...selectedTasks, task.id]);
                      } else {
                        setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                      }
                    }}
                  />
                  <label htmlFor={`task-${task.id}`} className="text-sm">
                    {task["Task Name"]}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
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
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        setTimeout(() => setStartDateOpen(false), 100);
                      }}
                      initialFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
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
                      selected={dueDate}
                      onSelect={(date) => {
                        setDueDate(date);
                        setTimeout(() => setDueDateOpen(false), 100);
                      }}
                      initialFocus
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="recurring-project" className="text-sm font-medium">Recurring Project</Label>
              <Switch
                id="recurring-project"
                checked={isRecurring}
                onCheckedChange={setIsRecurring}
              />
            </div>
            
            {isRecurring && (
              <div className="pl-4 pt-2 space-y-2">
                <Label htmlFor="daily-task-count" className="text-sm font-medium">Daily Task Count</Label>
                <Input
                  id="daily-task-count"
                  type="number"
                  min="1"
                  max="10"
                  value={recurringTaskCount}
                  onChange={(e) => setRecurringTaskCount(Number(e.target.value) || 1)}
                />
                <p className="text-xs text-muted-foreground">
                  Tasks will be generated daily between start and due dates.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Not started">Not started</SelectItem>
                <SelectItem value="In progress">In progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Task List</label>
            <Select value={taskListId} onValueChange={setTaskListId}>
              <SelectTrigger>
                <SelectValue placeholder="Select task list" />
              </SelectTrigger>
              <SelectContent>
                {taskLists.map((list) => (
                  <SelectItem key={list.id} value={list.id.toString()}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{initialData?.id ? 'Update' : 'Create'} Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
