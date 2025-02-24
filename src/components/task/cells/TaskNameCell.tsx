
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

  const handleTaskClick = () => {
    if (editingTaskId === task.id) return; // Don't open modal if already editing
    setIsModalOpen(true);
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
      
      <TaskEditModal
        task={task}
        taskLists={taskLists}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEditNameChange={(value) => {
          onEditNameChange(value);
          onEditSave(task.id);
        }}
        onUpdateProgress={onUpdateProgress}
        onMoveTask={onMoveTask}
        onTimelineEdit={onTimelineEdit}
      />
    </TableCell>
  );
};
