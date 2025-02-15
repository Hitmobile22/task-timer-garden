
import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PencilIcon, Check, X, ChevronRight, ChevronDown, Clock, ListFilter, Trash2 } from "lucide-react";
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { Task, Subtask } from '@/types/task.types';

interface TaskItemProps {
  task: Task;
  subtasks?: Subtask[];
  expandedTasks: number[];
  editingTaskId: number | null;
  editingTaskName: string;
  taskLists: any[];
  onToggleExpand: (taskId: number) => void;
  onEditStart: (task: Task | Subtask) => void;
  onEditCancel: () => void;
  onEditSave: (taskId: number, isSubtask?: boolean) => void;
  onEditNameChange: (value: string) => void;
  onUpdateProgress: (taskId: number, progress: Task['Progress'], isSubtask?: boolean) => void;
  onMoveTask: (taskId: number, listId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onTimelineEdit: (taskId: number, start: Date, end: Date) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  subtasks,
  expandedTasks,
  editingTaskId,
  editingTaskName,
  taskLists,
  onToggleExpand,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditNameChange,
  onUpdateProgress,
  onMoveTask,
  onDeleteTask,
  onTimelineEdit,
}) => {
  const [selectedStartDate, setSelectedStartDate] = React.useState<Date | undefined>(
    task.date_started ? new Date(task.date_started) : undefined
  );
  const [selectedEndDate, setSelectedEndDate] = React.useState<Date | undefined>(
    task.date_due ? new Date(task.date_due) : undefined
  );

  const handleTimelineUpdate = (startDate?: Date, endDate?: Date) => {
    if (startDate && endDate) {
      onTimelineEdit(task.id, startDate, endDate);
    }
  };

  const formatDateTime = (date: Date | undefined) => {
    if (!date) return '';
    return format(date, 'M/d h:mm a');
  };

  return (
    <React.Fragment>
      <TableRow>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {subtasks?.some(st => st["Parent Task ID"] === task.id) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0"
                onClick={() => onToggleExpand(task.id)}
              >
                {expandedTasks.includes(task.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            )}
            {editingTaskId === task.id ? (
              <div className="flex items-center gap-2 flex-grow">
                <Input
                  value={editingTaskName}
                  onChange={(e) => onEditNameChange(e.target.value)}
                  className="w-full"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEditSave(task.id)}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onEditCancel}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              task["Task Name"]
            )}
          </div>
        </TableCell>
        <TableCell>
          <Select
            value={task.Progress}
            onValueChange={(value: Task['Progress']) => onUpdateProgress(task.id, value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select progress" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Not started">Not started</SelectItem>
              <SelectItem value="In progress">In progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Backlog">Backlog</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
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
                        setSelectedStartDate(newDate);
                        handleTimelineUpdate(newDate, selectedEndDate);
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
                          setSelectedStartDate(newDate);
                          handleTimelineUpdate(newDate, selectedEndDate);
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
                        setSelectedEndDate(newDate);
                        handleTimelineUpdate(selectedStartDate, newDate);
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
                          setSelectedEndDate(newDate);
                          handleTimelineUpdate(selectedStartDate, newDate);
                        }
                      }}
                    />
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Select
              value={task.task_list_id?.toString() || ''}
              onValueChange={(value) => onMoveTask(task.id, parseInt(value))}
            >
              <SelectTrigger className="w-[150px]">
                <div className="flex items-center gap-2">
                  <ListFilter className="h-4 w-4" />
                  <SelectValue placeholder="Move to list" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {taskLists?.map((list) => (
                  <SelectItem 
                    key={list.id} 
                    value={list.id.toString()}
                    className="flex items-center gap-2"
                  >
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ 
                        backgroundColor: list.color || 'gray'
                      }} 
                    />
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {editingTaskId !== task.id && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEditStart(task)}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteTask(task.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};
