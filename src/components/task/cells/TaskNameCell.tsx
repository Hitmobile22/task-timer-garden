
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { Task, Subtask } from '@/types/task.types';

interface TaskNameCellProps {
  task: Task;
  subtasks?: Subtask[];
  expandedTasks: number[];
  editingTaskId: number | null;
  editingTaskName: string;
  onToggleExpand: (taskId: number) => void;
  onEditNameChange: (value: string) => void;
  onEditSave: (taskId: number) => void;
  onEditCancel: () => void;
}

export const TaskNameCell: React.FC<TaskNameCellProps> = ({
  task,
  subtasks,
  expandedTasks,
  editingTaskId,
  editingTaskName,
  onToggleExpand,
  onEditNameChange,
  onEditSave,
  onEditCancel,
}) => {
  return (
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
  );
};
