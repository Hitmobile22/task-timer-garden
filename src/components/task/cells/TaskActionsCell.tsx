
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListFilter, PencilIcon, Trash2, Check, X, Lock, Archive, ArchiveRestore } from "lucide-react";
import { Task } from '@/types/task.types';
import { isTaskTimeBlock } from '@/utils/taskUtils';
import { useArchiveActions } from '@/hooks/useArchiveActions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

interface TaskActionsCellProps {
  task: Task;
  isEditing: boolean;
  taskLists: any[];
  onMoveTask: (taskId: number, listId: number) => void;
  onEditStart: (task: Task) => void;
  onEditCancel: () => void;
  onEditSave: (taskId: number) => void;
  onDeleteTask: (taskId: number) => void;
  showArchived?: boolean;
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
  showArchived = false,
}) => {
  const currentList = taskLists?.find(list => list.id === task.task_list_id);
  const [tempListId, setTempListId] = React.useState<number | null>(task.task_list_id);
  const isTimeBlock = isTaskTimeBlock(task);
  const { archiveTask } = useArchiveActions();
  const queryClient = useQueryClient();

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

  const unarchiveTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ archived: false })
        .eq('id', taskId);
      
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task unarchived successfully');
    },
    onError: (error: Error) => {
      console.error('Unarchive task error:', error);
      toast.error('Failed to unarchive task');
    }
  });

  const handleUnarchiveTask = () => {
    unarchiveTaskMutation.mutate(task.id);
  };

  return (
    <TableCell>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            {isTimeBlock ? (
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
