
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Task, Subtask } from '@/types/task.types';
import { TaskItem } from './TaskItem';
import { SubtaskItem } from './SubtaskItem';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

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
  onArchiveTask?: (taskId: number) => void;
  onTimelineEdit: (taskId: number, start: Date, end: Date) => void;
  showArchived?: boolean;
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
  onArchiveTask,
  onTimelineEdit,
  showArchived = false,
}) => {
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [statusFilters, setStatusFilters] = useState<Task['Progress'][]>([]);
  const [showBacklog, setShowBacklog] = useState(false);

  const filteredTasks = tasks.filter(task => {
    const matchesArchived = showArchived ? task.archived : !task.archived;
    const matchesStatus = statusFilters.length === 0 || statusFilters.includes(task.Progress);
    const matchesBacklog = showBacklog || task.Progress !== 'Backlog';
    return matchesArchived && matchesStatus && matchesBacklog;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTasks(filteredTasks.map(task => task.id));
    } else {
      setSelectedTasks([]);
    }
  };

  const handleSelectTask = (taskId: number, checked: boolean) => {
    if (checked) {
      setSelectedTasks(prev => [...prev, taskId]);
    } else {
      setSelectedTasks(prev => prev.filter(id => id !== taskId));
    }
  };

  const handleBulkProgress = (progress: Task['Progress']) => {
    selectedTasks.forEach(taskId => {
      onUpdateProgress(taskId, progress);
    });
    setSelectedTasks([]);
  };

  const handleBulkMove = (listId: number) => {
    selectedTasks.forEach(taskId => {
      onMoveTask(taskId, listId);
    });
    setSelectedTasks([]);
  };

  const handleBulkArchive = () => {
    selectedTasks.forEach(taskId => {
      onArchiveTask?.(taskId);
    });
    setSelectedTasks([]);
  };

  const toggleStatusFilter = (status: Task['Progress']) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const isAllSelected = filteredTasks.length > 0 && selectedTasks.length === filteredTasks.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {['Not started', 'In progress', 'Completed', 'Backlog'].map((status) => (
            <Badge
              key={status}
              variant={statusFilters.includes(status as Task['Progress']) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => toggleStatusFilter(status as Task['Progress'])}
            >
              {status}
              {statusFilters.includes(status as Task['Progress']) && (
                <X className="ml-1 h-3 w-3" />
              )}
            </Badge>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowBacklog(!showBacklog)}
        >
          {showBacklog ? 'Hide' : 'Show'} Backlog
        </Button>
      </div>

      {selectedTasks.length > 0 && (
        <div className="flex gap-2 items-center bg-muted/50 p-2 rounded-lg">
          <span className="text-sm font-medium">{selectedTasks.length} selected</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleBulkProgress('In progress')}>
              Start
            </Button>
            <Button size="sm" onClick={() => handleBulkProgress('Completed')}>
              Complete
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBulkArchive()}>
              Archive
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all tasks"
              />
            </TableHead>
            <TableHead>Task Name</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead className="w-[250px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTasks.map((task) => (
            <React.Fragment key={task.id}>
              <TableRow>
                <TableCell>
                  <Checkbox
                    checked={selectedTasks.includes(task.id)}
                    onCheckedChange={(checked) => handleSelectTask(task.id, !!checked)}
                    aria-label={`Select task ${task["Task Name"]}`}
                  />
                </TableCell>
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
                  onArchiveTask={onArchiveTask}
                  onTimelineEdit={onTimelineEdit}
                />
              </TableRow>
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
  );
};

