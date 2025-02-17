
import React from 'react';
import { TableRow, TableCell } from "@/components/ui/table";
import { Task, Subtask } from '@/types/task.types';
import { TaskNameCell } from './cells/TaskNameCell';
import { TaskProgressCell } from './cells/TaskProgressCell';
import { TaskTimelineCell } from './cells/TaskTimelineCell';
import { TaskActionsCell } from './cells/TaskActionsCell';

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
  onArchiveTask?: (taskId: number) => void;
  onTimelineEdit: (taskId: number, start: Date, end: Date) => void;
  onAddSubtask?: (taskId: number) => void;
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
  onArchiveTask,
  onTimelineEdit,
  onAddSubtask,
}) => {
  const [selectedStartDate, setSelectedStartDate] = React.useState<Date | undefined>(
    task.date_started ? new Date(task.date_started) : undefined
  );
  const [selectedEndDate, setSelectedEndDate] = React.useState<Date | undefined>(
    task.date_due ? new Date(task.date_due) : undefined
  );
  const [tempProgress, setTempProgress] = React.useState<Task['Progress']>(task.Progress);
  const [tempListId, setTempListId] = React.useState<number | null>(task.task_list_id);

  React.useEffect(() => {
    setSelectedStartDate(task.date_started ? new Date(task.date_started) : undefined);
    setSelectedEndDate(task.date_due ? new Date(task.date_due) : undefined);
    setTempProgress(task.Progress);
    setTempListId(task.task_list_id);
  }, [task.date_started, task.date_due, task.Progress, task.task_list_id, editingTaskId]);

  const handleTimelineUpdate = (startDate?: Date, endDate?: Date) => {
    setSelectedStartDate(startDate);
    setSelectedEndDate(endDate);
  };

  const handleProgressUpdate = (progress: Task['Progress']) => {
    setTempProgress(progress);
  };

  const isEditing = editingTaskId === task.id;

  const handleSave = () => {
    if (selectedStartDate && selectedEndDate) {
      onTimelineEdit(task.id, selectedStartDate, selectedEndDate);
    }
    if (tempProgress !== task.Progress) {
      onUpdateProgress(task.id, tempProgress);
    }
    if (tempListId !== task.task_list_id) {
      onMoveTask(task.id, tempListId!);
    }
    onEditSave(task.id);
  };

  const getListName = () => {
    const list = taskLists.find(l => l.id === task.task_list_id);
    return list ? list.name : 'Uncategorized';
  };

  return (
    <TableRow>
      {/* Empty cell for checkbox/drag handle */}
      <TableCell className="w-[40px]"></TableCell>
      {/* Task Name */}
      <TableCell className="max-w-[300px]">
        <TaskNameCell
          task={task}
          subtasks={subtasks}
          isExpanded={expandedTasks.includes(task.id)}
          isEditing={isEditing}
          editingName={editingTaskName}
          onToggleExpand={() => onToggleExpand(task.id)}
          onEditNameChange={onEditNameChange}
          onAddSubtask={() => onAddSubtask?.(task.id)}
        />
      </TableCell>
      {/* List */}
      <TableCell className="w-[150px]">{getListName()}</TableCell>
      {/* Progress */}
      <TableCell className="w-[150px]">
        <TaskProgressCell
          task={{...task, Progress: tempProgress}}
          isEditing={isEditing}
          onUpdateProgress={handleProgressUpdate}
        />
      </TableCell>
      {/* Timeline */}
      <TableCell className="w-[200px]">
        <TaskTimelineCell
          startDate={selectedStartDate}
          endDate={selectedEndDate}
          isEditing={isEditing}
          onTimelineUpdate={handleTimelineUpdate}
        />
      </TableCell>
      {/* Actions */}
      <TableCell className="w-[150px] text-right">
        <TaskActionsCell
          task={{...task, task_list_id: tempListId}}
          isEditing={isEditing}
          taskLists={taskLists}
          onMoveTask={setTempListId}
          onEditStart={onEditStart}
          onEditCancel={onEditCancel}
          onEditSave={handleSave}
          onDeleteTask={onDeleteTask}
          onArchiveTask={onArchiveTask}
        />
      </TableCell>
    </TableRow>
  );
};
