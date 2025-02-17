import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Task, Subtask } from '@/types/task.types';
import { TaskItem } from './TaskItem';
import { SubtaskItem } from './SubtaskItem';
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Filter, GripVertical } from "lucide-react";

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
  onDragEnd?: (event: DragEndEvent) => void;
}

const SortableTaskRow = ({ children, id }: { children: React.ReactNode; id: number }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-[40px]">
        <Button 
          variant="ghost" 
          size="icon" 
          className="cursor-grab"
          {...attributes} 
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </TableCell>
      {children}
    </TableRow>
  );
};

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
  onDragEnd,
}) => {
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [statusFilters, setStatusFilters] = useState<Task['Progress'][]>(["Not started", "In progress"]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const filteredTasks = tasks.filter(task => {
    const matchesArchived = showArchived ? task.archived : !task.archived;
    const matchesStatus = statusFilters.includes(task.Progress);
    return matchesArchived && matchesStatus;
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

  const handleStatusFilterChange = (status: Task['Progress']) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const isAllSelected = filteredTasks.length > 0 && selectedTasks.length === filteredTasks.length;

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Status Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              {['Not started', 'In progress', 'Completed', 'Backlog'].map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilters.includes(status as Task['Progress'])}
                  onCheckedChange={() => handleStatusFilterChange(status as Task['Progress'])}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            onClick={() => setShowBulkEdit(!showBulkEdit)}
          >
            {showBulkEdit ? 'Hide' : 'Show'} Bulk Editor
          </Button>
        </div>
      </div>

      {showBulkEdit && selectedTasks.length > 0 && (
        <div className="bg-muted p-4 rounded-lg mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{selectedTasks.length} tasks selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={() => handleBulkProgress('In progress')}>
                Start
              </Button>
              <Button size="sm" variant="default" onClick={() => handleBulkProgress('Completed')}>
                Complete
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkArchive()}>
                Archive
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                {showBulkEdit ? (
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all tasks"
                  />
                ) : (
                  <span></span>
                )}
              </TableHead>
              <TableHead className="w-[40%]">Task Name</TableHead>
              <TableHead className="w-[15%]">List</TableHead>
              <TableHead className="w-[15%]">Progress</TableHead>
              <TableHead className="w-[15%]">Timeline</TableHead>
              <TableHead className="w-[15%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={filteredTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
                {filteredTasks.map((task) => (
                  <React.Fragment key={task.id}>
                    <SortableTaskRow key={task.id} id={task.id}>
                      {showBulkEdit && (
                        <TableCell>
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={(checked) => handleSelectTask(task.id, !!checked)}
                            aria-label={`Select task ${task["Task Name"]}`}
                          />
                        </TableCell>
                      )}
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
                    </SortableTaskRow>
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
              </SortableContext>
            </DndContext>
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
