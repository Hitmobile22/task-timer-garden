
import React, { useState } from 'react';
import { Check, Filter, Play, Clock } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from './ui/button';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
}

const SortableTaskItem = ({ task, children }) => {
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
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
};

export const TaskList: React.FC<TaskListProps> = ({ tasks: initialTasks, onTaskStart, subtasks }) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const isTaskView = location.pathname === '/tasks';
  const [selectedDate, setSelectedDate] = useState<Date>();

  const { data: dbTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: dbSubtasks } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: taskLists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('TaskLists')
        .select('*')
        .order('order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

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

  const updateTaskProgress = useMutation({
    mutationFn: async ({ id, isSubtask = false }: { id: number; isSubtask?: boolean }) => {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ Progress: 'Completed' })
        .eq('id', id);
      
      if (error) throw error;

      if (!isSubtask) {
        await updateRemainingTaskTimes();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task completed');
    },
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    try {
      // Convert the UniqueIdentifier to a number
      const taskId = typeof active.id === 'string' ? parseInt(active.id, 10) : active.id;
      const newOrder = over.data.current?.sortable?.index;

      if (isNaN(taskId)) {
        throw new Error('Invalid task ID');
      }

      const { error } = await supabase
        .from('Tasks')
        .update({ order: newOrder })
        .eq('id', taskId);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    } catch (error) {
      console.error('Error reordering tasks:', error);
      toast.error('Failed to reorder tasks');
    }
  };

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
      const notStartedTasks = dbTasks?.filter(t => t.Progress === 'Not started')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) || [];
      const selectedTask = dbTasks?.find(t => t.id === taskId);
      
      if (!selectedTask) return;

      const { error: updateError } = await supabase
        .from('Tasks')
        .update({
          Progress: 'In progress',
          date_started: new Date().toISOString(),
          date_due: new Date(Date.now() + 25 * 60 * 1000).toISOString()
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      const currentTime = new Date();
      currentTime.setMinutes(currentTime.getMinutes() + 30); // Start next task after 30 minutes
      
      for (let i = 0; i < notStartedTasks.length; i++) {
        const task = notStartedTasks[i];
        if (task.id === taskId) continue;

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

      onTaskStart?.(taskId);
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Timer started with selected task');
    } catch (error) {
      console.error('Error starting task:', error);
      toast.error('Failed to start task');
    }
  };

  if (!dbTasks || dbTasks.length === 0) return null;

  const filteredTasks = dbTasks
    .filter(task => {
      if (!isTaskView) {
        return task.Progress !== 'Completed';
      }
      
      switch (filter) {
        case 'active':
          return task.Progress !== 'Completed';
        case 'completed':
          return task.Progress === 'Completed';
        default:
          return true;
      }
    })
    .sort((a, b) => {
      // Always put completed tasks at the bottom
      if (a.Progress === 'Completed' && b.Progress !== 'Completed') return 1;
      if (a.Progress !== 'Completed' && b.Progress === 'Completed') return -1;
      
      // Sort by start time for non-completed tasks
      return new Date(a.date_started).getTime() - new Date(b.date_started).getTime();
    });

  if (!isTaskView) {
    return (
      <div className="space-y-4 animate-slideIn">
        <h2 className="text-lg font-semibold">Your Tasks</h2>
        <ul className="space-y-4">
          {(dbTasks || [])
            .filter(task => task.Progress !== 'Completed')
            .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime())
            .map((task) => (
              <li key={task.id} className="space-y-2">
                <div className={`flex items-center gap-3 p-3 rounded-md bg-white/50 hover:bg-white/80 transition-colors`}>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => updateTaskProgress.mutate({ id: task.id })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handleTaskStart(task.id)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-grow">
                    <span className="font-medium">{task["Task Name"]}</span>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(task.date_started), 'MMM d, h:mm a')}
                    </div>
                  </div>
                </div>

                {/* Show subtasks */}
                {dbSubtasks && dbSubtasks.filter(st => st["Parent Task ID"] === task.id).length > 0 && (
                  <ul className="pl-8 space-y-2">
                    {dbSubtasks
                      .filter(subtask => subtask["Parent Task ID"] === task.id)
                      .map((subtask) => (
                        <li
                          key={subtask.id}
                          className="flex items-center gap-3 p-2 rounded-md bg-white/30 hover:bg-white/50 transition-colors cursor-pointer"
                          onClick={() => updateTaskProgress.mutate({ id: subtask.id, isSubtask: true })}
                        >
                          <Button
                            size="icon"
                            variant="ghost"
                            className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTaskStart(subtask.id);
                            }}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          <span className="text-sm">
                            {subtask["Task Name"]}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slideIn">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Your Tasks</h2>
        {isTaskView && (
          <div className="flex gap-4">
            <Select
              value={filter}
              onValueChange={(value: 'all' | 'active' | 'completed') => setFilter(value)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter tasks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tasks</SelectItem>
                <SelectItem value="active">Active Tasks</SelectItem>
                <SelectItem value="completed">Completed Tasks</SelectItem>
              </SelectContent>
            </Select>
            
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select task list" />
              </SelectTrigger>
              <SelectContent>
                {taskLists?.map((list) => (
                  <SelectItem key={list.id} value={list.id.toString()}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredTasks.map(task => task.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-4">
            {filteredTasks.map((task) => (
              <SortableTaskItem key={task.id} task={task}>
                <li className="space-y-2">
                  <div 
                    className={`flex items-center gap-3 p-3 rounded-md bg-white/50 hover:bg-white/80 transition-colors ${
                      task.Progress === 'Completed' ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`flex-shrink-0 h-6 w-6 rounded-full ${
                          task.Progress === 'Completed' 
                            ? 'bg-green-500 text-white' 
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                        onClick={() => {
                          if (task.Progress !== 'Completed') {
                            updateTaskProgress.mutate({ id: task.id });
                          }
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      {task.Progress !== 'Completed' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                          onClick={() => handleTaskStart(task.id)}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex-grow">
                      <span className={`font-medium ${
                        task.Progress === 'Completed' ? 'line-through' : ''
                      }`}>
                        {task["Task Name"]}
                      </span>
                      {task.Progress !== 'Completed' && (
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(task.date_started), 'MMM d, h:mm a')}
                        </div>
                      )}
                    </div>
                  </div>

                  {dbSubtasks && dbSubtasks.filter(st => st["Parent Task ID"] === task.id).length > 0 && (
                    <ul className="pl-8 space-y-2">
                      {dbSubtasks
                        .filter(subtask => subtask["Parent Task ID"] === task.id)
                        .sort((a, b) => {
                          // Put completed subtasks at the bottom
                          if (a.Progress === 'Completed' && b.Progress !== 'Completed') return 1;
                          if (a.Progress !== 'Completed' && b.Progress === 'Completed') return -1;
                          return 0;
                        })
                        .map((subtask) => (
                          <li
                            key={subtask.id}
                            className={`flex items-center gap-3 p-2 rounded-md bg-white/30 hover:bg-white/50 transition-colors cursor-pointer ${
                              subtask.Progress === 'Completed' ? 'opacity-50' : ''
                            }`}
                            onClick={() => {
                              if (subtask.Progress !== 'Completed') {
                                updateTaskProgress.mutate({ id: subtask.id, isSubtask: true });
                              }
                            }}
                          >
                            <span className={`flex-shrink-0 h-5 w-5 flex items-center justify-center rounded-full ${
                              subtask.Progress === 'Completed'
                                ? 'bg-green-500 text-white'
                                : 'bg-primary/10 text-primary'
                            }`}>
                              <Check className="h-3 w-3" />
                            </span>
                            <span className={`flex-grow text-sm ${
                              subtask.Progress === 'Completed' ? 'line-through' : ''
                            }`}>
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
  );
};
