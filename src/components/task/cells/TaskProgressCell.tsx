
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task } from '@/types/task.types';

interface TaskProgressCellProps {
  task: Task;
  isEditing: boolean;
  onUpdateProgress: (taskId: number, progress: Task['Progress']) => void;
}

export const TaskProgressCell: React.FC<TaskProgressCellProps> = ({
  task,
  isEditing,
  onUpdateProgress,
}) => {
  return (
    <TableCell>
      {isEditing ? (
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
      ) : (
        <span className="text-sm">{task.Progress}</span>
      )}
    </TableCell>
  );
};
