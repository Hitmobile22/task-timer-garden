
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task } from '@/types/task.types';
import { Badge } from "@/components/ui/badge";
import { isTaskTimeBlock } from '@/utils/taskUtils';
import { syncGoogleCalendar } from '../GoogleCalendarIntegration';

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

  const handleProgressChange = (value: Task['Progress']) => {
    setTempProgress(value);
    onUpdateProgress(value);
    
    // Sync with Google Calendar after progress changes
    // This is especially important for completed tasks
    syncGoogleCalendar().catch(err => 
      console.error("Failed to sync calendar after changing task progress:", err)
    );
  };

  return (
    <TableCell>
      {isEditing ? (
        <Select
          value={tempProgress}
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
      ) : (
        <>
          {isTimeBlock ? (
            <div className="flex items-center">
              <Badge variant="outline" className="bg-[#FF5030]/20 text-[#FF5030] border-[#FF5030]/30">
                Time Block
              </Badge>
              <span className="ml-2 text-sm">{task.Progress}</span>
            </div>
          ) : (
            <span className="text-sm">{task.Progress}</span>
          )}
        </>
      )}
    </TableCell>
  );
};
