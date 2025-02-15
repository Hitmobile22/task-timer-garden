
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListFilter, PencilIcon, Trash2 } from "lucide-react";
import { Task } from '@/types/task.types';

interface TaskActionsCellProps {
  task: Task;
  editingTaskId: number | null;
  taskLists: any[];
  onMoveTask: (taskId: number, listId: number) => void;
  onEditStart: (task: Task) => void;
  onDeleteTask: (taskId: number) => void;
}

export const TaskActionsCell: React.FC<TaskActionsCellProps> = ({
  task,
  editingTaskId,
  taskLists,
  onMoveTask,
  onEditStart,
  onDeleteTask,
}) => {
  return (
    <TableCell>
      <div className="flex items-center gap-2">
        <Select
          value={task.task_list_id?.toString() || ''}
          onValueChange={(value) => onMoveTask(task.id, parseInt(value))}
        >
          <SelectTrigger className="w-[150px]">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4" />
              <SelectValue placeholder="Move to list" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {taskLists?.map((list) => (
              <SelectItem 
                key={list.id} 
                value={list.id.toString()}
                className="flex items-center gap-2"
              >
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ 
                    backgroundColor: list.color || 'gray'
                  }} 
                />
                {list.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {editingTaskId !== task.id && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEditStart(task)}
          >
            <PencilIcon className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDeleteTask(task.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </TableCell>
  );
};
