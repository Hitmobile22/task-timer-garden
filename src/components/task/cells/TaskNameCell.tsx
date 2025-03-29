
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Task, Subtask } from '@/types/task.types';
import { TaskEditModal } from '../TaskEditModal';

interface TaskNameCellProps {
  task: Task;
  subtasks?: Subtask[];
  expandedTasks: number[];
  editingTaskId: number | null;
  editingTaskName: string;
  taskLists: any[];
  onToggleExpand: (taskId: number) => void;
  onEditNameChange: (value: string) => void;
  onEditSave: (taskId: number) => void;
  onEditCancel: () => void;
  onUpdateProgress: (taskId: number, progress: Task['Progress']) => void;
  onMoveTask: (taskId: number, listId: number) => void;
  onTimelineEdit: (taskId: number, start: Date, end: Date) => void;
}

export const TaskNameCell: React.FC<TaskNameCellProps> = ({
  task,
  subtasks,
  expandedTasks,
  editingTaskId,
  editingTaskName,
  taskLists,
  onToggleExpand,
  onEditNameChange,
  onEditSave,
  onEditCancel,
  onUpdateProgress,
  onMoveTask,
  onTimelineEdit,
}) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [currentTaskId, setCurrentTaskId] = React.useState<number | null>(null);

  // When opening the modal, track the current task id to ensure we're editing the correct task
  const handleTaskClick = () => {
    if (editingTaskId === task.id) return; // Don't open modal if already editing
    setCurrentTaskId(task.id);
    setIsModalOpen(true);
  };

  // Reset the tracked task id when closing the modal
  const handleModalClose = () => {
    setIsModalOpen(false);
    setCurrentTaskId(null);
  };

  // Only proceed with edits if the task id matches
  const handleEditSave = (newName: string) => {
    if (currentTaskId === task.id) {
      console.log("TaskNameCell: Saving task name for task ID:", task.id, "New name:", newName);
      onEditNameChange(newName);
      onEditSave(task.id);
    } else {
      console.error("TaskNameCell: Task ID mismatch. Current:", currentTaskId, "Expected:", task.id);
    }
  };

  return (
    <TableCell className="font-medium">
      <div className="flex items-center gap-2">
        {subtasks?.some(st => st["Parent Task ID"] === task.id) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0"
            onClick={() => onToggleExpand(task.id)}
          >
            {expandedTasks.includes(task.id) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
        {editingTaskId === task.id ? (
          <div className="flex items-center gap-2 flex-grow">
            <Input
              value={editingTaskName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="w-full"
            />
          </div>
        ) : (
          <span 
            className="cursor-pointer hover:text-blue-600 transition-colors"
            onClick={handleTaskClick}
          >
            {task["Task Name"]}
          </span>
        )}
      </div>
      
      {currentTaskId === task.id && (
        <TaskEditModal
          task={task}
          taskLists={taskLists}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onEditNameChange={handleEditSave}
          onUpdateProgress={onUpdateProgress}
          onMoveTask={onMoveTask}
          onTimelineEdit={onTimelineEdit}
        />
      )}
    </TableCell>
  );
};
