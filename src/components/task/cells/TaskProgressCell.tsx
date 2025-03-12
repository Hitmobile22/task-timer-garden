
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task } from '@/types/task.types';
import { Badge } from "@/components/ui/badge";
import { isTaskTimeBlock } from '@/utils/taskUtils';

interface TaskProgressCellProps {
  task: Task;
  isEditing: boolean;
  onUpdateProgress: (progress: Task['Progress']) => void;
}

export const TaskProgressCell: React.FC<TaskProgressCellProps> = ({
  task,
  isEditing,
  onUpdateProgress,
}) => {
  const [tempProgress, setTempProgress] = React.useState<Task['Progress']>(task.Progress);
  const isTimeBlock = isTaskTimeBlock(task);

  React.useEffect(() => {
    setTempProgress(task.Progress);
  }, [task.Progress, isEditing]);

  if (isTimeBlock) {
    return (
      <TableCell>
        <Badge variant="outline" className="bg-[#FF5030]/20 text-[#FF5030] border-[#FF5030]/30">
          Time Block
        </Badge>
      </TableCell>
    );
  }

  return (
    <TableCell>
      {isEditing ? (
        <Select
          value={tempProgress}
          onValueChange={(value: Task['Progress']) => {
            setTempProgress(value);
            onUpdateProgress(value);
          }}
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
