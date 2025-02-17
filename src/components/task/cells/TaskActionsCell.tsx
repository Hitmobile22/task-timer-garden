import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Task } from '@/types/task.types';
import { Button } from "@/components/ui/button";
import { Plus, PencilIcon, Archive, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TaskActionsCellProps {
  task: Task;
  isEditing: boolean;
  taskLists: any[];
  onMoveTask: (listId: number | null) => void;
  onEditStart: (task: Task) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onDeleteTask: (taskId: number) => void;
  onArchiveTask: (taskId: number) => void;
  onAddSubtask: (taskId: number) => void;
}

export const TaskActionsCell: React.FC<TaskActionsCellProps> = ({
  task,
  isEditing,
  taskLists,
  onMoveTask,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDeleteTask,
  onArchiveTask,
  onAddSubtask,
}) => {
  const currentList = taskLists?.find(list => list.id === task.task_list_id);

  return (
    <TableCell>
      <div className="flex items-center gap-1">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Select onValueChange={(value) => onMoveTask(value === "none" ? null : parseInt(value))}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={currentList ? currentList.name : "Move to list"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No List</SelectItem>
                {taskLists?.map(list => (
                  <SelectItem key={list.id} value={list.id.toString()}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={onEditSave}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditCancel}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm">
              {currentList && (
                <div className="flex items-center gap-1.5">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ 
                      backgroundColor: currentList.color || 'gray'
                    }} 
                  />
                  <span>{currentList.name}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onAddSubtask(task.id)}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEditStart(task)}
                className="h-8 w-8"
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onArchiveTask(task.id)}
                className={cn(
                  "h-8 w-8",
                  task.archived && "text-yellow-600 hover:text-yellow-700"
                )}
                title={task.archived ? "Unarchive" : "Archive"}
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteTask(task.id)}
                className="h-8 w-8 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </TableCell>
  );
};
