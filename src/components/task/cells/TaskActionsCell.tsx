
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Task } from '@/types/task.types';
import { Edit2, Trash2, MoreHorizontal, ArrowRight, LockIcon, Play } from "lucide-react";

interface TaskActionsCellProps {
  task: Task;
  isEditing: boolean;
  taskLists: any[];
  onMoveTask: (taskId: number, listId: number) => void;
  onEditStart: (task: Task) => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onDeleteTask: (taskId: number) => void;
  isTimeBlock?: boolean;
  onTaskStart?: (taskId: number) => void;
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
  isTimeBlock = false,
  onTaskStart,
}) => {
  return (
    <TableCell className="text-right">
      {isEditing ? (
        <div className="flex justify-end space-x-2">
          <Button variant="ghost" size="sm" onClick={onEditCancel}>
            Cancel
          </Button>
          <Button variant="default" size="sm" onClick={onEditSave}>
            Save
          </Button>
        </div>
      ) : (
        <div className="flex justify-end space-x-2">
          {isTimeBlock && (
            <Button variant="ghost" size="sm" className="text-amber-600" disabled>
              <LockIcon className="h-4 w-4 mr-1" />
              Time Block
            </Button>
          )}
          
          {!isTimeBlock && onTaskStart && (
            <Button variant="ghost" size="icon" onClick={() => onTaskStart(task.id)}>
              <Play className="h-4 w-4" />
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onEditStart(task)} 
            disabled={isTimeBlock}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onDeleteTask(task.id)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
              
              {taskLists && taskLists.length > 0 && task.task_list_id && !isTimeBlock && (
                <>
                  <DropdownMenuItem disabled className="opacity-50 text-xs font-semibold">
                    Move to list:
                  </DropdownMenuItem>
                  {taskLists.map((list) => (
                    <DropdownMenuItem 
                      key={list.id}
                      onClick={() => onMoveTask(task.id, list.id)}
                      disabled={list.id === task.task_list_id}
                      className={list.id === task.task_list_id ? "bg-gray-100" : ""}
                    >
                      <ArrowRight className="h-4 w-4 mr-2" />
                      {list.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </TableCell>
  );
};
