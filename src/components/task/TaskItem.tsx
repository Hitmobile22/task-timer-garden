import React from 'react';
import { TableRow } from "@/components/ui/table";
import { Task, Subtask } from '@/types/task.types';
import { TaskNameCell } from './cells/TaskNameCell';
import { TaskProgressCell } from './cells/TaskProgressCell';
import { TaskTimelineCell } from './cells/TaskTimelineCell';
import { TaskActionsCell } from './cells/TaskActionsCell';
import { getTaskListColor, extractSolidColorFromGradient, isTaskTimeBlock } from '@/utils/taskUtils';
import { DEFAULT_LIST_COLOR } from '@/constants/taskColors';
import { cn } from '@/lib/utils';

interface TaskItemProps {
  task: Task;
  subtasks?: Subtask[];
  expandedTasks: number[];
  editingTaskId: number | null;
  editingTaskName: string;
  taskLists: any[];
  showArchived: boolean; // Add showArchived prop
  dragHandleProps?: Record<string, any>;
  onToggleExpand: (taskId: number) => void;
  onEditStart: (task: Task | Subtask) => void;
  onEditCancel: () => void;
  onEditSave: (taskId: number, isSubtask?: boolean) => void;
  onEditNameChange: (value: string) => void;
  onUpdateProgress: (taskId: number, progress: Task['Progress'], isSubtask?: boolean) => void;
  onMoveTask: (taskId: number, listId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onTimelineEdit: (taskId: number, start: Date, end: Date) => void;
  onUnarchiveTask?: (taskId: number) => void; // Add optional unarchive handler
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  subtasks,
  expandedTasks,
  editingTaskId,
  editingTaskName,
  taskLists,
  showArchived,
  dragHandleProps = {},
  onToggleExpand,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditNameChange,
  onUpdateProgress,
  onMoveTask,
  onDeleteTask,
  onTimelineEdit,
  onUnarchiveTask,
}) => {
  const [selectedStartDate, setSelectedStartDate] = React.useState<Date | undefined>(
    task.date_started ? new Date(task.date_started) : undefined
  );
  const [selectedEndDate, setSelectedEndDate] = React.useState<Date | undefined>(
    task.date_due ? new Date(task.date_due) : undefined
  );
  const [tempProgress, setTempProgress] = React.useState<Task['Progress']>(task.Progress);
  const isTimeBlock = isTaskTimeBlock(task);

  const taskListColor = React.useMemo(() => {
    if (task.task_list_id && taskLists && taskLists.length > 0) {
      return getTaskListColor(task.task_list_id, taskLists);
    }
    return DEFAULT_LIST_COLOR;
  }, [task.task_list_id, taskLists]);

  const borderColor = React.useMemo(() => {
    return extractSolidColorFromGradient(taskListColor);
  }, [taskListColor]);

  React.useEffect(() => {
    setSelectedStartDate(task.date_started ? new Date(task.date_started) : undefined);
    setSelectedEndDate(task.date_due ? new Date(task.date_due) : undefined);
    setTempProgress(task.Progress);
  }, [task.date_started, task.date_due, task.Progress, editingTaskId]);

  const handleTimelineUpdate = (startDate?: Date, endDate?: Date) => {
    // Don't update timeline for time blocks
    if (isTimeBlock) return;
    
    setSelectedStartDate(startDate);
    setSelectedEndDate(endDate);
  };

  const handleProgressUpdate = (progress: Task['Progress']) => {
    setTempProgress(progress);
  };

  const isEditing = editingTaskId === task.id;

  const handleSave = () => {
    if (selectedStartDate && selectedEndDate && !isTimeBlock) {
      onTimelineEdit(task.id, selectedStartDate, selectedEndDate);
    }
    if (tempProgress !== task.Progress) {
      onUpdateProgress(task.id, tempProgress);
    }
    onEditSave(task.id);
  };

  return (
    <React.Fragment>
      <TableRow className={cn(
        task.task_list_id !== 1 ? "border-l-4" : "",
        isTimeBlock ? "bg-[#FF5030]/20" : ""
      )}
      style={task.task_list_id !== 1 ? {
        borderLeftColor: borderColor
      } : undefined}>
        <TaskNameCell
          task={task}
          subtasks={subtasks}
          expandedTasks={expandedTasks}
          editingTaskId={editingTaskId}
          editingTaskName={editingTaskName}
          taskLists={taskLists}
          dragHandleProps={dragHandleProps}
          onToggleExpand={onToggleExpand}
          onEditNameChange={onEditNameChange}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
          onUpdateProgress={onUpdateProgress}
          onMoveTask={onMoveTask}
          onTimelineEdit={onTimelineEdit}
        />
        <TaskProgressCell
          task={{...task, Progress: tempProgress}}
          isEditing={isEditing}
          onUpdateProgress={handleProgressUpdate}
        />
        <TaskTimelineCell
          startDate={selectedStartDate}
          endDate={selectedEndDate}
          isEditing={isEditing && !isTimeBlock}
          isTimeBlock={isTimeBlock}
          onTimelineUpdate={handleTimelineUpdate}
        />
        <TaskActionsCell
          task={task}
          isEditing={isEditing}
          taskLists={taskLists}
          showArchived={showArchived}
          onMoveTask={onMoveTask}
          onEditStart={onEditStart}
          onEditCancel={onEditCancel}
          onEditSave={handleSave}
          onDeleteTask={onDeleteTask}
          onUnarchiveTask={onUnarchiveTask}
        />
      </TableRow>
    </React.Fragment>
  );
};
