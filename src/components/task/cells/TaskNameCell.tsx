
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Task, Subtask } from '@/types/task.types';
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Plus } from "lucide-react";

interface TaskNameCellProps {
  task: Task;
  subtasks?: Subtask[];
  isExpanded: boolean;
  isEditing: boolean;
  editingName: string;
  onToggleExpand: () => void;
  onEditNameChange: (value: string) => void;
  onAddSubtask: () => void;
}

export const TaskNameCell: React.FC<TaskNameCellProps> = ({
  task,
  subtasks,
  isExpanded,
  isEditing,
  editingName,
  onToggleExpand,
  onEditNameChange,
  onAddSubtask,
}) => {
  const hasSubtasks = subtasks?.some(st => st["Parent Task ID"] === task.id);
  
  return (
    <TableCell className="w-full">
      <div className="flex items-center gap-2">
        {hasSubtasks && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleExpand}
            className="h-4 w-4 p-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
        {isEditing ? (
          <Input
            value={editingName}
            onChange={(e) => onEditNameChange(e.target.value)}
            className="max-w-sm"
          />
        ) : (
          <div className="flex items-center gap-2 w-full">
            <span className="flex-1">{task["Task Name"]}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddSubtask}
              className="h-6 w-6"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </TableCell>
  );
};
