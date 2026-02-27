
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListFilter, PencilIcon, Trash2, Check, X, Lock, Archive, ArchiveRestore } from "lucide-react";
import { Task } from '@/types/task.types';
import { isTaskTimeBlock } from '@/utils/taskUtils';
import { useLocation } from 'react-router-dom';

interface TaskActionsCellProps {
  task: Task;
  isEditing: boolean;
  taskLists: any[];
  showArchived: boolean; // Add showArchived prop
  onMoveTask: (taskId: number, listId: number) => void;
  onEditStart: (task: Task) => void;
  onEditCancel: () => void;
  onEditSave: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
  onUnarchiveTask?: (taskId: number) => void; // Add optional unarchive handler
}

export const TaskActionsCell: React.FC<TaskActionsCellProps> = ({
  task,
  isEditing,
  taskLists,
  showArchived,
  onMoveTask,
  onEditStart,
  onEditCancel,
  onEditSave,
  onDeleteTask,
  onUnarchiveTask,
}) => {
  const currentList = taskLists?.find(list => list.id === task.task_list_id);
  const [tempListId, setTempListId] = React.useState<number | null>(task.task_list_id);
  const isTimeBlock = isTaskTimeBlock(task);
  const location = useLocation();
  const isTaskViewPage = location.pathname === '/tasks';
  const isTimeBlockLocked = isTimeBlock && !isTaskViewPage;
  const { archiveTask } = useArchiveActions();

  React.useEffect(() => {
    console.log('TaskActionsCell: task_list_id changed:', task.task_list_id);
    setTempListId(task.task_list_id);
  }, [task.task_list_id, isEditing]);

  const handleSave = () => {
    console.log('TaskActionsCell: handleSave called', {
      taskId: task.id,
      tempListId,
      currentListId: task.task_list_id
    });
    
    if (tempListId !== null) {
      console.log('TaskActionsCell: Calling onMoveTask with:', {
        taskId: task.id,
        listId: tempListId
      });
      onMoveTask(task.id, tempListId);
      onEditSave(task.id);
    }
  };
  
  const handleArchiveTask = () => {
    archiveTask.mutate(task.id);
  };

  const handleUnarchiveTask = () => {
    if (onUnarchiveTask) {
      onUnarchiveTask(task.id);
    }
  };

  return (
    <TableCell>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            {isTimeBlockLocked ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" />
                <span>Time block (locked)</span>
              </div>
            ) : (
              <Select
                value={tempListId?.toString() || ''}
                onValueChange={(value) => {
                  console.log('TaskActionsCell: Select value changed to:', value);
                  setTempListId(parseInt(value));
                }}
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
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={isTimeBlock}
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
              onClick={() => onDeleteTask(task.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            {showArchived ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUnarchiveTask}
                title="Unarchive task"
              >
                <ArchiveRestore className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleArchiveTask}
                title="Archive task"
              >
                <Archive className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </TableCell>
  );
};
