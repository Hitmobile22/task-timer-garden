import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Task, Subtask } from '@/types/task.types';
import { TaskActionsCell } from './cells/TaskActionsCell';
import { Button } from '@/components/ui/button';

interface TaskListComponentProps {
  tasks: Task[];
  subtasks?: Subtask[];
  expandedTasks: number[];
  editingTaskId: number | null;
  editingTaskName: string;
  taskLists?: any[];
  showArchived?: boolean;
  onToggleExpand: (taskId: number) => void;
  onEditStart: (task: Task) => void;
  onEditCancel: () => void;
  onEditSave: (taskId: number) => void;
  onEditNameChange: (name: string) => void;
  onUpdateProgress: (taskId: number, progress: Task['Progress'], isSubtask?: boolean) => void;
  onMoveTask: (taskId: number, listId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onTimelineEdit: (taskId: number, start: string, end: string) => void;
}

export const TaskListComponent: React.FC<TaskListComponentProps> = ({
  tasks,
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
  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div key={task.id} className="border rounded-lg p-4 bg-white/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Button onClick={() => onToggleExpand(task.id)}>
                {expandedTasks.includes(task.id) ? '-' : '+'}
              </Button>
              <span className="ml-2">{task["Task Name"]}</span>
            </div>
            <TaskActionsCell
              task={task}
              isEditing={editingTaskId === task.id}
              taskLists={taskLists || []}
              showArchived={showArchived}
              onMoveTask={onMoveTask}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onDeleteTask={onDeleteTask}
            />
          </div>
          {expandedTasks.includes(task.id) && subtasks && (
            <div className="pl-4">
              {subtasks.filter(subtask => subtask["Parent Task ID"] === task.id).map(subtask => (
                <div key={subtask.id} className="flex justify-between items-center">
                  <span>{subtask["Task Name"]}</span>
                  <Button onClick={() => onUpdateProgress(subtask.id, 'Completed', true)}>Complete</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
