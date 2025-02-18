
import React from 'react';
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
import { CalendarIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { Task } from '@/types/task.types';

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (projectData: any) => void;
  taskLists: any[];
  availableTasks: Task[];
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  onClose,
  onSubmit,
  taskLists,
  availableTasks,
}) => {
  const [name, setName] = React.useState("");
  const [selectedTasks, setSelectedTasks] = React.useState<number[]>([]);
  const [startDate, setStartDate] = React.useState<Date>();
  const [dueDate, setDueDate] = React.useState<Date>();
  const [status, setStatus] = React.useState<string>("Not started");
  const [taskListId, setTaskListId] = React.useState<string>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      selectedTasks,
      startDate,
      dueDate,
      status,
      taskListId: taskListId ? parseInt(taskListId) : undefined,
    });
    handleReset();
  };

  const handleReset = () => {
    setName("");
    setSelectedTasks([]);
    setStartDate(undefined);
    setDueDate(undefined);
    setStatus("Not started");
    setTaskListId(undefined);
  };

  return (
    <Dialog open={open} onOpenChange={() => {
      handleReset();
      onClose();
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
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
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
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
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
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
            <Button type="submit">Create Project</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

