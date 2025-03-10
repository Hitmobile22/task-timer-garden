
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Task, Subtask } from '@/types/task.types';
import { TaskItem } from './task/TaskItem';
import { SubtaskItem } from './task/SubtaskItem';

interface TaskListProps {
  tasks: Task[];
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
  onTimelineEdit: (taskId: number, start: Date, end: Date) => void;
  onTaskStart?: (taskId: number) => void;
  activeTaskId?: number;
}

export const TaskListComponent: React.FC<TaskListProps> = ({
  tasks,
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
  onTimelineEdit,
  onTaskStart,
  activeTaskId,
}) => {
  console.log('TaskListComponent: Received onMoveTask function:', !!onMoveTask);
  console.log('TaskListComponent: Received tasks:', tasks.length, 'items');
  
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Task Name</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Timeline</TableHead>
          <TableHead className="w-[200px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => (
          <React.Fragment key={task.id}>
            <TaskItem
              task={task}
              subtasks={subtasks}
              expandedTasks={expandedTasks}
              editingTaskId={editingTaskId}
              editingTaskName={editingTaskName}
              taskLists={taskLists}
              onToggleExpand={onToggleExpand}
              onEditStart={onEditStart}
              onEditCancel={onEditCancel}
              onEditSave={onEditSave}
              onEditNameChange={onEditNameChange}
              onUpdateProgress={onUpdateProgress}
              onMoveTask={onMoveTask}
              onDeleteTask={onDeleteTask}
              onTimelineEdit={onTimelineEdit}
              onTaskStart={onTaskStart}
              activeTaskId={activeTaskId}
            />
            {expandedTasks.includes(task.id) && subtasks?.filter(st => st["Parent Task ID"] === task.id).map(subtask => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                editingTaskId={editingTaskId}
                editingTaskName={editingTaskName}
                onEditStart={onEditStart}
                onEditCancel={onEditCancel}
                onEditSave={onEditSave}
                onEditNameChange={onEditNameChange}
                onUpdateProgress={onUpdateProgress}
                onDeleteTask={onDeleteTask}
              />
            ))}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
};

// Create a named export for TaskList for easier imports
export const TaskList = TaskListComponent;
