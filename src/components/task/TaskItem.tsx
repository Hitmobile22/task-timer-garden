import React from 'react';
import { TableRow } from "@/components/ui/table";
import { TaskNameCell } from './cells/TaskNameCell';
import { TaskProgressCell } from './cells/TaskProgressCell';
import { TaskTimelineCell } from './cells/TaskTimelineCell';
import { TaskActionsCell } from './cells/TaskActionsCell';
import { Task, Subtask } from '@/types/task.types';
import { cn } from '@/lib/utils';
import { useTaskListColors } from '@/hooks/useTaskListColors';

interface TaskItemProps {
  task: Task;
  subtasks?: Subtask[];
  expandedTasks: number[];
  editingTaskId: number | null;
  editingTaskName: string;
  taskLists: any[];
  showArchived?: boolean;
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
  showArchived = false,
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
  const taskListColor = useTaskListColors(task.task_list_id, taskLists);
  const taskColorClass = taskListColor ? `bg-[${taskListColor}]` : 'bg-gray-100';

  return (
    <TableRow className={cn(
      "border-b border-border/50",
      taskColorClass,
      task.Progress === 'Completed' && "opacity-60"
    )}>
      <TaskNameCell
        task={task}
        subtasks={subtasks}
        expandedTasks={expandedTasks}
        editingTaskId={editingTaskId}
        editingTaskName={editingTaskName}
        onToggleExpand={onToggleExpand}
        onEditStart={onEditStart}
        onEditNameChange={onEditNameChange}
      />
      <TaskProgressCell
        task={task}
        onUpdateProgress={onUpdateProgress}
      />
      <TaskTimelineCell
        task={task}
        onTimelineEdit={onTimelineEdit}
      />
      <TaskActionsCell
        task={task}
        isEditing={editingTaskId === task.id}
        taskLists={taskLists}
        showArchived={showArchived}
        onMoveTask={onMoveTask}
        onEditStart={onEditStart}
        onEditCancel={onEditCancel}
        onEditSave={onEditSave}
        onDeleteTask={onDeleteTask}
      />
    </TableRow>
  );
};
