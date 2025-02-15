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
  const [searchQuery, setSearchQuery] = useState('');
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
      
      // Filter for today's tasks
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      return data.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        return taskDate && taskDate >= today && taskDate < tomorrow;
      });
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
      const allTasks = dbTasks?.filter(t => 
        t.Progress === 'Not started' || t.Progress === 'In progress'
      ) || [];
      const selectedTask = allTasks.find(t => t.id === taskId);
      
      if (!selectedTask) return;

      const currentTime = new Date();
      const today = new Date(currentTime);
      today.setHours(23, 59, 59, 999); // End of today
      
      // First, handle the selected task
      const { error: startError } = await supabase
        .from('Tasks')
        .update({
          Progress: 'In progress',
          date_started: currentTime.toISOString(),
          date_due: new Date(currentTime.getTime() + 25 * 60000).toISOString()
        })
        .eq('id', taskId);

      if (startError) throw startError;

      // Get all other active tasks for today and sort them by start time
      const otherTasks = allTasks
        .filter(t => t.id !== taskId && t.date_started && new Date(t.date_started) < today)
        .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime());

      // Reschedule other tasks to avoid overlaps
      let nextStartTime = new Date(currentTime.getTime() + 30 * 60000); // Start 30 minutes after current task

      for (const task of otherTasks) {
        // Don't schedule past end of day
        if (nextStartTime > today) break;
        
        const taskStartTime = new Date(nextStartTime);
        const taskEndTime = new Date(taskStartTime.getTime() + 25 * 60000);

        const { error } = await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString()
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

  if (!isTaskView) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4 p-4 sm:p-6 animate-slideIn">
        <h2 className="text-xl font-semibold">Your Tasks</h2>
        <ul className="space-y-4">
          {(dbTasks || [])
            .filter(task => task.Progress !== 'Completed')
            .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime())
            .map((task) => (
              <li key={task.id} className="space-y-2">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-white/50 hover:bg-white/80 transition-colors shadow-sm">
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => updateTaskProgress.mutate({ id: task.id })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
                      onClick={() => handleTaskStart(task.id)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-grow min-w-0">
                    <span className="font-medium block truncate">{task["Task Name"]}</span>
                    <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      <span>{formatTaskDateTime(task.date_started)}</span>
                    </div>
                  </div>
                </div>

                {dbSubtasks && dbSubtasks.filter(st => st["Parent Task ID"] === task.id).length > 0 && (
                  <ul className="pl-6 space-y-2">
                    {dbSubtasks
                      .filter(subtask => subtask["Parent Task ID"] === task.id)
                      .map((subtask) => (
                        <li
                          key={subtask.id}
                          className="flex items-center gap-3 p-3 rounded-lg bg-white/30 hover:bg-white/50 transition-colors"
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
            ))}
        </ul>
      </div>
    );
  }

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
          <Select
            value={filter}
            onValueChange={(value: 'all' | 'active' | 'completed') => setFilter(value)}
          >
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 shadow-sm">
        <DndContext
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

                    {dbSubtasks && dbSubtasks.filter(st => st["Parent Task ID"] === task.id).length > 0 && (
                      <ul className="pl-6 space-y-2">
                        {dbSubtasks
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
