
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
  dragHandleProps?: Record<string, any>; // Define as Record<string, any> to ensure it's always an object type
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
  dragHandleProps = {}, // Default to empty object to ensure it's always an object
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
    
    console.log("TaskNameCell: Opening modal for task ID:", task.id, "Task Name:", task["Task Name"]);
    setCurrentTaskId(task.id);
    setIsModalOpen(true);
  };

  // Reset the tracked task id when closing the modal
  const handleModalClose = () => {
    console.log("TaskNameCell: Closing modal for task ID:", currentTaskId);
    setIsModalOpen(false);
    // Keep the currentTaskId set until after the modal is fully closed
    // This ensures we don't lose track of which task we were editing
  };

  // Only proceed with edits if the task id matches
  const handleEditSave = (newName: string) => {
    console.log("TaskNameCell: Saving task name. Current ID:", currentTaskId, "Task ID:", task.id, "New name:", newName);
    
    if (currentTaskId === task.id) {
      onEditNameChange(newName);
      onEditSave(task.id);
    } else {
      console.error("TaskNameCell: Task ID mismatch. Current:", currentTaskId, "Expected:", task.id);
    }
  };

  // Use effect to ensure we're only showing the modal for the current task
  React.useEffect(() => {
    if (!isModalOpen) {
      // Reset the currentTaskId when the modal is closed
      // Use a small timeout to ensure all operations have completed
      const timer = setTimeout(() => {
        if (!isModalOpen) {
          setCurrentTaskId(null);
        }
      }, 200);
      
      return () => clearTimeout(timer);
    }
  }, [isModalOpen]);

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
              autoFocus
            />
          </div>
        ) : (
          <span 
            className="cursor-pointer hover:text-blue-600 transition-colors"
            onClick={handleTaskClick}
          >
            {task["Task Name"] || "Unnamed Task"}
          </span>
        )}
      </div>
      
      {isModalOpen && (
        <TaskEditModal
          task={task}
          open={isModalOpen}
          onOpenChange={handleModalClose}
          taskLists={taskLists}
          onSave={(updatedTask) => {
            // This will be called when the task is saved in the modal
            if (updatedTask["Task Name"] !== task["Task Name"]) {
              handleEditSave(updatedTask["Task Name"]);
            }
            if (updatedTask.Progress !== task.Progress) {
              onUpdateProgress(task.id, updatedTask.Progress);
            }
            if (
              (updatedTask.date_started !== task.date_started || 
               updatedTask.date_due !== task.date_due) && 
              updatedTask.date_started && 
              updatedTask.date_due
            ) {
              onTimelineEdit(
                task.id, 
                new Date(updatedTask.date_started), 
                new Date(updatedTask.date_due)
              );
            }
            if (updatedTask.task_list_id !== task.task_list_id && updatedTask.task_list_id) {
              onMoveTask(task.id, updatedTask.task_list_id);
            }
          }}
        />
      )}
    </TableCell>
  );
};
