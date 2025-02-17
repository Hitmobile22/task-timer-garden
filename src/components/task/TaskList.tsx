
import React, { useState, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Task, Subtask } from '@/types/task.types';
import { TaskItem } from './TaskItem';
import { SubtaskItem } from './SubtaskItem';
import { Button } from "@/components/ui/button";
import { PencilIcon, ListFilter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface TaskListProps {
  tasks: Task[];
  subtasks?: Subtask[];
  expandedTasks: number[];
  editingTaskId: number | null;
  editingTaskName: string;
  taskLists: any[];
  bulkMode: boolean;
  selectedTasks: number[];
  showArchived: boolean;
  showHeader?: boolean;
  onToggleExpand: (taskId: number) => void;
  onEditStart: (task: Task | Subtask) => void;
  onEditCancel: () => void;
  onEditSave: (taskId: number, isSubtask?: boolean) => void;
  onEditNameChange: (value: string) => void;
  onUpdateProgress: (taskId: number, progress: Task['Progress'], isSubtask?: boolean) => void;
  onMoveTask: (taskId: number, listId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onArchiveTask: (taskId: number) => void;
  onAddSubtask: (taskId: number) => void;
  onTimelineEdit: (taskId: number, start: Date, end: Date) => void;
  onBulkSelect: (taskId: number, selected: boolean) => void;
  onBulkProgressUpdate: (progress: Task['Progress']) => void;
}

export const TaskListComponent: React.FC<TaskListProps> = ({
  tasks,
  subtasks,
  expandedTasks,
  editingTaskId,
  editingTaskName,
  taskLists,
  bulkMode,
  selectedTasks,
  showArchived,
  showHeader = true,
  onToggleExpand,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditNameChange,
  onUpdateProgress,
  onMoveTask,
  onDeleteTask,
  onArchiveTask,
  onAddSubtask,
  onTimelineEdit,
  onBulkSelect,
  onBulkProgressUpdate,
}) => {
  return (
    <div className="space-y-4">
      {bulkMode && selectedTasks.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-primary/10 rounded-lg">
          <span className="text-sm font-medium">{selectedTasks.length} tasks selected</span>
          <Select onValueChange={onBulkProgressUpdate}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Update progress" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Not started">Not started</SelectItem>
              <SelectItem value="In progress">In progress</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Backlog">Backlog</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="relative">
        <Table>
          {showHeader && (
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                {bulkMode && (
                  <TableHead className="w-[50px]">Select</TableHead>
                )}
                <TableHead>Task Name</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Timeline</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            {tasks?.filter(task => showArchived || !task.archived).map((task) => (
              <React.Fragment key={task.id}>
                <TaskItem
                  task={task}
                  subtasks={subtasks}
                  expandedTasks={expandedTasks}
                  editingTaskId={editingTaskId}
                  editingTaskName={editingTaskName}
                  taskLists={taskLists}
                  bulkMode={bulkMode}
                  isSelected={selectedTasks.includes(task.id)}
                  onToggleExpand={onToggleExpand}
                  onEditStart={onEditStart}
                  onEditCancel={onEditCancel}
                  onEditSave={onEditSave}
                  onEditNameChange={onEditNameChange}
                  onUpdateProgress={onUpdateProgress}
                  onMoveTask={onMoveTask}
                  onDeleteTask={onDeleteTask}
                  onArchiveTask={onArchiveTask}
                  onAddSubtask={onAddSubtask}
                  onTimelineEdit={onTimelineEdit}
                  onBulkSelect={onBulkSelect}
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
      </div>
    </div>
  );
};
