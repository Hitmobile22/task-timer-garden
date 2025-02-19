import React, { useState } from 'react';
import { Check, Filter, Play, Clock, GripVertical, ChevronUp, ChevronDown, Circle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { format, addDays, setHours, setMinutes, isBefore, isAfter, startOfDay, subDays } from 'date-fns';
import { Button } from './ui/button';
import { cn } from "@/lib/utils";
import { DndContext, closestCenter, DragEndEvent, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SubTask {
  name: string;
}

interface Task {
  name: string;
  subtasks: SubTask[];
}

interface TaskListProps {
  tasks: Task[];
  onTaskStart?: (taskId: number) => void;
  subtasks?: any[];
  taskLists?: any[];
}

interface TaskItemProps {
  task: any;
  subtasks?: any[];
  dragHandleProps?: any;
  updateTaskProgress: any;
  onTaskStart?: (taskId: number) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  subtasks,
  dragHandleProps,
  updateTaskProgress,
  onTaskStart
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasSubtasks = subtasks?.some(st => st["Parent Task ID"] === task.id);

  return (
    <li className="space-y-2">
      <div className="flex items-start gap-3 p-4 rounded-lg bg-white/50 hover:bg-white/80 transition-colors shadow-sm">
        <div className="flex gap-2 flex-shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="touch-none cursor-grab flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "flex-shrink-0 h-8 w-8 rounded-full",
              task.Progress === 'Completed'
                ? "bg-green-500 text-white"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
            onClick={() => updateTaskProgress.mutate({ id: task.id })}
          >
            <Check className="h-4 w-4" />
          </Button>
          {task.Progress !== 'Completed' && (
            <Button
              size="icon"
              variant="ghost"
              className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
              onClick={() => onTaskStart?.(task.id)}
            >
              <Play className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={cn(
              "font-bold break-words",
              task.Progress === 'Completed' && "line-through text-gray-500"
            )}>
              {task["Task Name"]}
            </span>
            {task.Progress !== 'Completed' && (
              <span className="text-xs text-gray-500 flex items-center gap-1 whitespace-nowrap mt-1">
                <Clock className="h-3 w-3" />
                {format(new Date(task.date_started), 'M/d h:mm a')}
              </span>
            )}
          </div>
        </div>
        {hasSubtasks && (
          <Button
            size="icon"
            variant="ghost"
            className="flex-shrink-0 h-8 w-8 rounded-full hover:bg-primary/10"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {hasSubtasks && isExpanded && (
        <ul className="pl-6 space-y-2">
          {subtasks
            .filter(subtask => subtask["Parent Task ID"] === task.id)
            .sort((a, b) => {
              if (a.Progress === 'Completed' && b.Progress !== 'Completed') return 1;
              if (a.Progress !== 'Completed' && b.Progress === 'Completed') return -1;
              return 0;
            })
            .map((subtask) => (
              <li
                key={subtask.id}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg bg-white/30 hover:bg-white/50 transition-colors"
                )}
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "flex-shrink-0 h-6 w-6 rounded-full",
                    subtask.Progress === 'Completed'
                      ? "bg-green-500 text-white"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  )}
                  onClick={() => updateTaskProgress.mutate({ id: subtask.id, isSubtask: true })}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <span className={cn(
                  "text-sm font-bold break-words",
                  subtask.Progress === 'Completed' && "line-through text-gray-500"
                )}>
                  {subtask["Task Name"]}
                </span>
              </li>
            ))}
        </ul>
      )}
    </li>
  );
};

const SortableTaskItem: React.FC<{ task: any; children: React.ReactElement }> = ({ task, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {React.cloneElement(children, { 
        dragHandleProps: { ...attributes, ...listeners }
      })}
    </div>
  );
};

export const TaskList: React.FC<TaskListProps> = ({ tasks: initialTasks, onTaskStart, subtasks, taskLists }) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const isTaskView = location.pathname === '/tasks';

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const { data: dbTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const today = new Date();
      const tomorrow5AM = addDays(today, 1);
      tomorrow5AM.setHours(5, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      
      if (!isTaskView) {
        return data.filter(task => {
          const taskDate = task.date_started ? new Date(task.date_started) : null;
          if (!taskDate) return false;

          if (today.getHours() < 5) {
            const yesterday9PM = new Date(today);
            yesterday9PM.setDate(yesterday9PM.getDate() - 1);
            yesterday9PM.setHours(21, 0, 0, 0);
            return taskDate >= yesterday9PM && taskDate <= tomorrow5AM;
          }

          const today9PM = new Date(today);
          today9PM.setHours(21, 0, 0, 0);
          return taskDate <= tomorrow5AM;
        });
      }
      
      return data;
    },
  });

  const updateTaskOrder = useMutation({
    mutationFn: async ({ tasks, shouldResetTimer, movedTaskId }: { tasks: any[], shouldResetTimer: boolean, movedTaskId: number }) => {
      const currentTask = tasks.find(t => t.Progress === 'In progress');
      const movedTask = tasks.find(t => t.id === movedTaskId);
      const oldIndex = tasks.findIndex(t => t.id === movedTaskId);
      const newIndex = tasks.findIndex(t => t.id === movedTaskId);
      const isMovingToFirst = newIndex === 0;
      const isMovingCurrentTask = currentTask && movedTaskId === currentTask.id;
      
      console.log('Task update operation:', {
        currentTaskId: currentTask?.id,
        movedTaskId,
        oldIndex,
        newIndex,
        isMovingToFirst,
        isMovingCurrentTask
      });

      const shouldUpdateCurrentTask = isMovingCurrentTask || isMovingToFirst;
      const currentTime = new Date();
      let nextStartTime = new Date(currentTime);

      if (!shouldUpdateCurrentTask && currentTask) {
        nextStartTime = new Date(new Date(currentTask.date_started).getTime() + 30 * 60 * 1000);
      }

      const updates = [];
      
      for (const task of tasks) {
        if (task.Progress === 'Completed') continue;

        const isCurrentTask = currentTask && task.id === currentTask.id;
        const isFirst = tasks.indexOf(task) === 0;

        let taskStartTime: Date;
        let taskEndTime: Date;

        if (isCurrentTask && !shouldUpdateCurrentTask) {
          taskStartTime = new Date(currentTask.date_started);
          taskEndTime = new Date(currentTask.date_due);
          console.log('Preserving current task time:', taskStartTime);
        } else {
          if (isFirst && shouldUpdateCurrentTask) {
            taskStartTime = currentTime;
          } else {
            taskStartTime = new Date(nextStartTime);
          }
          taskEndTime = new Date(taskStartTime.getTime() + 25 * 60 * 1000);
          nextStartTime = new Date(taskEndTime.getTime() + 5 * 60 * 1000);
        }

        const updateData: any = {
          id: task.id,
          date_started: taskStartTime.toISOString(),
          date_due: taskEndTime.toISOString(),
        };

        if (isCurrentTask && !isFirst && shouldUpdateCurrentTask) {
          updateData.Progress = 'Not started';
        } else if (isFirst && shouldUpdateCurrentTask && !isCurrentTask) {
          updateData.Progress = 'In progress';
        }

        console.log('Updating task:', {
          taskName: task["Task Name"],
          startTime: taskStartTime,
          endTime: taskEndTime,
          isCurrentTask,
          progress: updateData.Progress || task.Progress
        });

        updates.push(updateData);
      }

      for (const update of updates) {
        const { error } = await supabase
          .from('Tasks')
          .update(update)
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task schedule updated');
    },
    onError: (error) => {
      console.error('Error updating task schedule:', error);
      toast.error('Failed to update task schedule');
    }
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !dbTasks) return;

    const oldIndex = dbTasks.findIndex(t => t.id === active.id);
    const newIndex = dbTasks.findIndex(t => t.id === over.id);
    
    const reorderedTasks = [...dbTasks];
    const [movedTask] = reorderedTasks.splice(oldIndex, 1);
    reorderedTasks.splice(newIndex, 0, movedTask);

    const currentTask = reorderedTasks.find(t => t.Progress === 'In progress');
    const isMovingToFirst = newIndex === 0;
    const isMovingCurrentTask = currentTask && movedTask.id === currentTask.id;
    
    await updateTaskOrder.mutate({ 
      tasks: reorderedTasks,
      shouldResetTimer: isMovingToFirst || isMovingCurrentTask,
      movedTaskId: movedTask.id
    });
  };

  const updateTaskProgress = useMutation({
    mutationFn: async ({ id, isSubtask = false }: { id: number; isSubtask?: boolean }) => {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ Progress: 'Completed' })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['today-subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task completed');
    },
  });

  if (!isTaskView) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4 p-4 sm:p-6 animate-slideIn">
        <h2 className="text-xl font-semibold">Today's Tasks</h2>
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter} 
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={dbTasks?.map(t => t.id) || []} strategy={verticalListSortingStrategy}>
            <ul className="space-y-4">
              {(dbTasks || [])
                .filter(task => ['Not started', 'In progress'].includes(task.Progress))
                .map((task) => (
                  <SortableTaskItem key={task.id} task={task}>
                    <TaskItem
                      task={task}
                      subtasks={subtasks}
                      updateTaskProgress={updateTaskProgress}
                      onTaskStart={onTaskStart}
                    />
                  </SortableTaskItem>
                ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  const updateTaskTimes = useMutation({
    mutationFn: async ({ taskId, startDate, endDate }: { taskId: number; startDate: Date; endDate: Date }) => {
      const { error } = await supabase
        .from('Tasks')
        .update({
          date_started: startDate.toISOString(),
          date_due: endDate.toISOString()
        })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task times updated');
    },
  });

  const updateRemainingTaskTimes = async () => {
    try {
      const notStartedTasks = dbTasks?.filter(t => t.Progress === 'Not started') || [];
      
      if (notStartedTasks.length === 0) return;

      const currentTime = new Date();
      currentTime.setMinutes(currentTime.getMinutes() + 30); // Start with 30-minute offset
      
      for (let i = 0; i < notStartedTasks.length; i++) {
        const task = notStartedTasks[i];
        const taskStartTime = new Date(currentTime);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + (i * 30)); // 25 min task + 5 min break
        
        const taskDueTime = new Date(taskStartTime);
        taskDueTime.setMinutes(taskDueTime.getMinutes() + 25);

        const { error } = await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskDueTime.toISOString()
          })
          .eq('id', task.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating task times:', error);
      toast.error('Failed to update task times');
    }
  };

  const handleTaskStart = async (taskId: number) => {
    try {
      const allTasks = dbTasks?.filter(t => 
        t.Progress === 'Not started' || t.Progress === 'In progress'
      ) || [];
      const selectedTask = allTasks.find(t => t.id === taskId);
      
      if (!selectedTask) return;

      const currentTime = new Date();
      const tomorrow5AM = new Date(currentTime);
      tomorrow5AM.setDate(tomorrow5AM.getDate() + 1);
      tomorrow5AM.setHours(5, 0, 0, 0);
      
      const { error: startError } = await supabase
        .from('Tasks')
        .update({
          Progress: 'In progress',
          date_started: currentTime.toISOString(),
          date_due: new Date(currentTime.getTime() + 25 * 60000).toISOString()
        })
        .eq('id', taskId);

      if (startError) throw startError;

      const otherTasks = allTasks
        .filter(t => t.id !== taskId)
        .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime());

      let nextStartTime = new Date(currentTime.getTime() + 30 * 60000); // Start 30 minutes after current task

      for (const task of otherTasks) {
        if (currentTime.getHours() >= 21 && isAfter(nextStartTime, tomorrow5AM)) {
          break;
        }
        
        const taskStartTime = new Date(nextStartTime);
        const taskEndTime = new Date(taskStartTime.getTime() + 25 * 60000);

        const { error } = await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            Progress: 'Not started'
          })
          .eq('id', task.id);

        if (error) throw error;

        nextStartTime = new Date(taskStartTime.getTime() + 30 * 60000);
      }

      onTaskStart?.(taskId);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Timer started and schedule adjusted');
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Failed to start task');
    }
  };

  const formatTaskDateTime = (date: string) => {
    return format(new Date(date), 'M/d h:mm a');
  };

  if (!dbTasks || dbTasks.length === 0) return null;

  const filteredTasks = dbTasks
    .filter(task => {
      const matchesSearch = searchQuery 
        ? task["Task Name"].toLowerCase().includes(searchQuery.toLowerCase())
        : true;

      if (!isTaskView) {
        return task.Progress !== 'Completed' && matchesSearch;
      }
      
      const matchesFilter = filter === 'all' 
        ? true 
        : filter === 'active' 
          ? task.Progress !== 'Completed'
          : task.Progress === 'Completed';

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (a.Progress === 'Completed' && b.Progress !== 'Completed') return 1;
      if (a.Progress !== 'Completed' && b.Progress === 'Completed') return -1;
      return new Date(a.date_started).getTime() - new Date(b.date_started).getTime();
    });

  const formatTaskTime = (date: string) => {
    return format(new Date(date), 'h:mm a');
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 p-4 sm:p-6 animate-slideIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-semibold">Your Tasks</h2>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-[200px]">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 shadow-sm">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={filteredTasks.map(task => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-3">
              {filteredTasks.map((task) => (
                <SortableTaskItem key={task.id} task={task}>
                  <li className="space-y-2">
                    <div className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors border border-gray-100",
                      task.Progress === 'Completed'
                        ? "bg-gray-50/80"
                        : "bg-white hover:bg-gray-50"
                    )}>
                      <div className="flex gap-2">
                        {task.task_list_id !== 1 && taskLists?.find(l => l.id === task.task_list_id) && (
                          <Circle 
                            className="h-3 w-3 flex-shrink-0" 
                            style={{ 
                              color: taskLists.find(l => l.id === task.task_list_id)?.color || undefined 
                            }} 
                            fill="currentColor"
                          />
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "flex-shrink-0 h-8 w-8 rounded-full",
                            task.Progress === 'Completed'
                              ? "bg-green-500 text-white"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          )}
                          onClick={() => updateTaskProgress.mutate({ id: task.id })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        {task.Progress !== 'Completed' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                            onClick={() => handleTaskStart(task.id)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium block truncate",
                            task.Progress === 'Completed' && "line-through text-gray-500"
                          )}>
                            {task["Task Name"]}
                          </span>
                          {task.Progress !== 'Completed' && (
                            <span className="text-xs text-gray-500 flex items-center gap-1 whitespace-nowrap">
                              <Clock className="h-3 w-3" />
                              {formatTaskDateTime(task.date_started)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {subtasks && subtasks.filter(st => st["Parent Task ID"] === task.id).length > 0 && (
                      <ul className="pl-6 space-y-2">
                        {subtasks
                          .filter(subtask => subtask["Parent Task ID"] === task.id)
                          .sort((a, b) => {
                            if (a.Progress === 'Completed' && b.Progress !== 'Completed') return 1;
                            if (a.Progress !== 'Completed' && b.Progress === 'Completed') return -1;
                            return 0;
                          })
                          .map((subtask) => (
                            <li
                              key={subtask.id}
                              className={cn(
                                "flex items-center gap-3 p-2.5 rounded-lg transition-colors border border-gray-100",
                                subtask.Progress === 'Completed'
                                  ? "bg-gray-50/80"
                                  : "bg-white hover:bg-gray-50"
                              )}
                            >
                              <Button
                                size="icon"
                                variant="ghost"
                                className={cn(
                                  "flex-shrink-0 h-6 w-6 rounded-full",
                                  subtask.Progress === 'Completed'
                                    ? "bg-green-500 text-white"
                                    : "bg-primary/10 text-primary hover:bg-primary/20"
                                )}
                                onClick={() => updateTaskProgress.mutate({ id: subtask.id, isSubtask: true })}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <span className={cn(
                                "text-sm truncate",
                                subtask.Progress === 'Completed' && "line-through text-gray-500"
                              )}>
                                {subtask["Task Name"]}
                              </span>
                            </li>
                          ))}
                      </ul>
                    )}
                  </li>
                </SortableTaskItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
