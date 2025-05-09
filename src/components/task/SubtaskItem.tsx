
import React from 'react';
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PencilIcon, Check, X, Trash2 } from "lucide-react";
import { Task, Subtask } from '@/types/task.types';

interface SubtaskItemProps {
  subtask: Subtask;
  editingTaskId?: number | null;
  editingTaskName?: string;
  onEditStart?: (task: Task | Subtask) => void;
  onEditCancel?: () => void;
  onEditSave?: (taskId: number, isSubtask?: boolean) => void;
  onEditNameChange?: (value: string) => void;
  onUpdateProgress:
    | ((progress: Task['Progress']) => void)
    | ((taskId: number, progress: Task['Progress'], isSubtask?: boolean) => void);
  onDeleteTask?: (taskId: number) => void;
  onDelete?: () => void;
}

export const SubtaskItem: React.FC<SubtaskItemProps> = ({
  subtask,
  editingTaskId,
  editingTaskName,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditNameChange,
  onUpdateProgress,
  onDeleteTask,
  onDelete,
}) => {
  const handleProgressChange = (value: Task['Progress']) => {
    if (typeof onUpdateProgress === 'function') {
      // Check if the function expects multiple parameters
      if (onUpdateProgress.length >= 2) {
        // Call with taskId and progress
        (onUpdateProgress as (taskId: number, progress: Task['Progress'], isSubtask?: boolean) => void)(
          subtask.id,
          value,
          true
        );
      } else {
        // Call with just progress
        (onUpdateProgress as (progress: Task['Progress']) => void)(value);
      }
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    } else if (onDeleteTask) {
      onDeleteTask(subtask.id);
    }
  };

  return (
    <TableRow className="bg-muted/50">
      <TableCell className="pl-10">
        {editingTaskId === subtask.id ? (
          <div className="flex items-center gap-2">
            <Input
              value={editingTaskName}
              onChange={(e) => onEditNameChange && onEditNameChange(e.target.value)}
              className="w-full"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditSave && onEditSave(subtask.id, true)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditCancel && onEditCancel()}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div 
              className="h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center cursor-pointer"
              onClick={() => handleProgressChange('Completed')}
            >
              <Check className="h-4 w-4" />
            </div>
            <span>└─ {subtask["Task Name"]}</span>
            {onEditStart && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEditStart(subtask)}
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Select
          value={subtask.Progress}
          onValueChange={handleProgressChange}
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
      <TableCell></TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
};
