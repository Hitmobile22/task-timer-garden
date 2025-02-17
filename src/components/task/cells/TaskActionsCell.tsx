
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListFilter, PencilIcon, Trash2, Check, X, Archive } from "lucide-react";
import { Task } from '@/types/task.types';

interface TaskActionsCellProps {
  task: Task;
  isEditing: boolean;
  taskLists: any[];
  onMoveTask: (taskId: number, listId: number) => void;
  onEditStart: (task: Task) => void;
  onEditCancel: () => void;
  onEditSave: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onArchiveTask?: (taskId: number) => void;
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
}) => {
  const currentList = taskLists?.find(list => list.id === task.task_list_id);
  const [tempListId, setTempListId] = React.useState<number | null>(task.task_list_id);

  React.useEffect(() => {
    setTempListId(task.task_list_id);
  }, [task.task_list_id, isEditing]);
  
  return (
    <TableCell>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Select
              value={tempListId?.toString() || ''}
              onValueChange={(value) => setTempListId(parseInt(value))}
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditSave(task.id)}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEditCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditStart(task)}
            >
              <PencilIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onArchiveTask?.(task.id)}
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteTask(task.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </TableCell>
  );
};
