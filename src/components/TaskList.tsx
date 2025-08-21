import React, { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { format, addDays, isAfter, isBefore } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { DndContext, closestCenter, DragEndEvent, TouchSensor, MouseSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { Check, Filter, Play, Clock, GripVertical, ChevronUp, ChevronDown, Circle, PencilIcon, Plus, X, Minus } from 'lucide-react';
import { Task, Subtask } from '@/types/task.types';
import { getTaskListColor, extractSolidColorFromGradient, isTaskTimeBlock, isCurrentTask } from '@/utils/taskUtils';
import { DEFAULT_LIST_COLOR } from '@/constants/taskColors';

interface SubtaskData {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  "Parent Task ID": number;
}

interface TaskListProps {
  tasks: Task[];
  onTaskStart?: (taskId: number) => void;
  subtasks?: Subtask[];
  taskLists?: any[];
  activeTaskId?: number;
  onMoveTask?: (taskId: number, listId: number) => void;
}

interface TaskItemProps {
  task: Task;
  subtasks?: Subtask[];
  dragHandleProps?: any;
  updateTaskProgress: any;
  onTaskStart?: (taskId: number) => void;
  isCurrentTask?: boolean;
  taskLists?: any[];
  updateTaskOrderMutation?: any; // Add this prop to pass the mutation down
}

const EditTaskModal = ({
  isOpen,
  onClose,
  task,
  subtasks,
  onSave
}: {
  isOpen: boolean;
  onClose: () => void;
  task: any;
  subtasks?: Subtask[];
  onSave: (taskName: string, subtasks: Subtask[], taskDuration: number) => void;
}) => {
  const [taskName, setTaskName] = useState(task["Task Name"]);
  const [editingSubtasks, setEditingSubtasks] = useState<Subtask[]>(subtasks?.filter(st => st["Parent Task ID"] === task.id) || []);
  const [newSubtask, setNewSubtask] = useState("");
  const [taskDuration, setTaskDuration] = useState(25); // Default task duration
  const queryClient = useQueryClient();
  
  // Initialize task duration from details if available
  React.useEffect(() => {
    if (task.details) {
      try {
        const details = typeof task.details === 'string' 
          ? JSON.parse(task.details) 
          : task.details;
        
        if (details && details.taskDuration && typeof details.taskDuration === 'number') {
          setTaskDuration(details.taskDuration);
        }
      } catch (error) {
        console.error('Error parsing task details:', error);
      }
    }
  }, [task]);
  
  const handleSave = () => {
    onSave(taskName, editingSubtasks, taskDuration);
    onClose();
  };
  
  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setEditingSubtasks([...editingSubtasks, {
      id: Date.now(),
      "Task Name": newSubtask,
      Progress: "Not started",
      "Parent Task ID": task.id
    }]);
    setNewSubtask("");
  };
  
  const removeSubtask = (subtaskId: number) => {
    setEditingSubtasks(editingSubtasks.filter(st => st.id !== subtaskId));
  };
  
  const incrementTaskDuration = () => {
    setTaskDuration(prev => prev + 5);
  };
  
  const decrementTaskDuration = () => {
    setTaskDuration(prev => prev > 5 ? prev - 5 : 5);
  };
  
  const handlePushTask = async () => {
    try {
      const { data, error } = await supabase
        .from('Tasks')
        .select('date_started, date_due')
        .eq('id', task.id)
        .single();
      
      if (error) throw error;
      
      if (!data.date_started || !data.date_due) {
        toast.error("Task doesn't have valid dates to reschedule");
        return;
      }
      
      const currentStartDate = new Date(data.date_started);
      const currentEndDate = new Date(data.date_due);
      
      const nextDayStart = addDays(currentStartDate, 1);
      const nextDayEnd = addDays(currentEndDate, 1);
      
      const { error: updateError } = await supabase
        .from('Tasks')
        .update({
          date_started: nextDayStart.toISOString(),
          date_due: nextDayEnd.toISOString()
        })
        .eq('id', task.id);
      
      if (updateError) throw updateError;
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      
      toast.success("Task scheduled for tomorrow");
      onClose();
    } catch (error) {
      console.error('Error pushing task:', error);
      toast.error("Failed to reschedule task");
    }
  };
  
  const handleDuplicateTask = async () => {
    try {
      // Get current user for authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        toast.error('Authentication required to duplicate task');
        return;
      }

      // Create a new task as a copy of the current task, but only include fields that exist in the database
      const { data: newTask, error: taskError } = await supabase
        .from('Tasks')
        .insert([{
          "Task Name": task["Task Name"],
          Progress: "Not started",
          task_list_id: task.task_list_id,
          project_id: task.project_id,
          date_started: task.date_started,
          date_due: task.date_due,
          details: task.details,
          user_id: user.id  // Add user_id to comply with RLS policy
          // IsTimeBlock field is removed as it doesn't exist in the database
        }])
        .select()
        .single();

      if (taskError) throw taskError;

      // If there are subtasks, duplicate them for the new task
      if (editingSubtasks.length > 0) {
        // Create an array of new subtasks objects
        const newSubtasks = editingSubtasks.map(subtask => ({
          "Task Name": subtask["Task Name"],
          "Parent Task ID": newTask.id,
          Progress: "Not started" as const,
          user_id: user.id  // Add user_id to comply with RLS policy
        }));

        // Insert all new subtasks at once
        const { error: subtaskError } = await supabase
          .from('subtasks')
          .insert(newSubtasks);

        if (subtaskError) throw subtaskError;
      }

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['today-subtasks'] });
      
      toast.success('Task duplicated successfully');
      onClose();
    } catch (error) {
      console.error('Error duplicating task:', error);
      toast.error('Failed to duplicate task');
    }
  };
  
  return <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">Task Name</Label>
            <Input id="task-name" value={taskName} onChange={e => setTaskName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Task Time (minutes)</Label>
            <div className="flex items-center gap-2">
              <Button 
                type="button"
                variant="outline" 
                size="icon" 
                onClick={decrementTaskDuration} 
                disabled={taskDuration <= 5}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input 
                type="number" 
                value={taskDuration} 
                onChange={e => setTaskDuration(Math.max(5, parseInt(e.target.value) || 5))}
                className="text-center"
              />
              <Button 
                type="button"
                variant="outline" 
                size="icon" 
                onClick={incrementTaskDuration}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subtasks</Label>
            <div className="space-y-2">
              {editingSubtasks.map(subtask => <div key={subtask.id} className="flex items-center gap-2">
                  <Input value={subtask["Task Name"]} onChange={e => {
                setEditingSubtasks(prev => prev.map(st => st.id === subtask.id ? {
                  ...st,
                  "Task Name": e.target.value
                } : st));
              }} />
                  <Button variant="ghost" size="icon" onClick={() => removeSubtask(subtask.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>)}
              <div className="flex items-center gap-2">
                <Input placeholder="New subtask" value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyPress={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubtask();
                }
              }} />
                <Button variant="ghost" size="icon" onClick={addSubtask}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handlePushTask}>Push task</Button>
            <Button variant="secondary" onClick={handleDuplicateTask}>Duplicate</Button>
          </div>
          <Button onClick={handleSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>;
};

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  subtasks,
  dragHandleProps,
  updateTaskProgress,
  onTaskStart,
  isCurrentTask,
  taskLists,
  updateTaskOrderMutation
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const queryClient = useQueryClient();
  const hasSubtasks = subtasks?.some(st => st["Parent Task ID"] === task.id);
  const location = useLocation();
  const isTaskView = location.pathname === '/tasks';
  const isTimeBlock = isTaskTimeBlock(task);
  
  const taskListColor = task.task_list_id && taskLists ? 
    getTaskListColor(task.task_list_id, taskLists) : 
    DEFAULT_LIST_COLOR;
  
  const borderColor = extractSolidColorFromGradient(taskListColor);
  
  console.log(`Task ${task.id} (${task["Task Name"]}): list_id=${task.task_list_id}, color=${taskListColor}, border=${borderColor}`);
  
  const handleEditSave = async (newTaskName: string, newSubtasks: SubtaskData[], taskDuration: number) => {
    try {
      // Initialize taskDetails as an empty object
      let taskDetails: Record<string, any> = {};
      
      // Safely parse task.details if it exists
      if (task.details) {
        if (typeof task.details === 'string') {
          try {
            const parsed = JSON.parse(task.details);
            if (parsed && typeof parsed === 'object') {
              taskDetails = parsed;
            }
          } catch (e) {
            console.error('Error parsing task details:', e);
            // Keep taskDetails as empty object if parsing fails
          }
        } else if (typeof task.details === 'object' && task.details !== null) {
          // If task.details is already an object, use it directly
          taskDetails = { ...task.details };
        }
      }
        
      // Update task details with new duration
      const updatedDetails = {
        ...taskDetails,
        taskDuration: taskDuration
      };
      
      if (newTaskName !== task["Task Name"] || updatedDetails.taskDuration !== taskDetails.taskDuration) {
        await supabase.from('Tasks').update({
          "Task Name": newTaskName,
          details: updatedDetails
        }).eq('id', task.id);
      }
      
      const existingSubtasks = subtasks?.filter(st => st["Parent Task ID"] === task.id) || [];
      const subtasksToAdd = newSubtasks.filter(st => !st.id || st.id > Date.now() - 1000000);
      const subtasksToUpdate = newSubtasks.filter(st => st.id && st.id < Date.now() - 1000000);
      const subtasksToDelete = existingSubtasks.filter(est => !newSubtasks.some(nst => nst.id === est.id));
      
      if (subtasksToAdd.length > 0) {
        const newSubtasksData = subtasksToAdd.map(st => ({
          "Task Name": st["Task Name"],
          "Parent Task ID": task.id,
          Progress: "Not started" as const
        }));
        await supabase.from('subtasks').insert(newSubtasksData);
      }
      
      for (const subtask of subtasksToUpdate) {
        await supabase.from('subtasks').update({
          "Task Name": subtask["Task Name"]
        }).eq('id', subtask.id);
      }
      
      if (subtasksToDelete.length > 0) {
        await supabase.from('subtasks').delete().in('id', subtasksToDelete.map(st => st.id));
      }
      
      // Invalidate queries to refresh task data including durations
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['today-subtasks']
      });
      
      // Fetch the updated tasks
      const { data: updatedTasks } = await supabase
        .from('Tasks')
        .select('*')
        .order('date_started', { ascending: true });
        
      if (updatedTasks && updateTaskOrderMutation) {
        // Now reschedule tasks based on the updated duration
        await updateTaskOrderMutation.mutate({
          tasks: updatedTasks,
          shouldResetTimer: false,
          movedTaskId: task.id
        });
      }
      
      toast.success('Task updated successfully');
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  return <li className="space-y-2">
      <div 
        className={cn(
          "flex items-start gap-3 p-4 rounded-lg transition-colors shadow-sm", 
          isCurrentTask ? "bg-white" : isTimeBlock ? "bg-[#FF5030]/20 hover:bg-[#FF5030]/30" : "bg-white/50 hover:bg-white/80",
          task.task_list_id && task.task_list_id !== 1 && !isCurrentTask ? "border-l-4" : ""
        )}
        style={task.task_list_id && task.task_list_id !== 1 && !isCurrentTask ? {
          borderLeftColor: borderColor
        } : undefined}
      >
        <div className="flex gap-2 flex-shrink-0">
          <Button size="icon" variant="ghost" className="touch-none cursor-grab flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20" {...dragHandleProps}>
            <GripVertical className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" className={cn("flex-shrink-0 h-8 w-8 rounded-full", task.Progress === 'Completed' ? "bg-green-500 text-white" : "bg-primary/10 text-primary hover:bg-primary/20")} onClick={() => updateTaskProgress.mutate({
          id: task.id
        })}>
            <Check className="h-4 w-4" />
          </Button>
          {task.Progress !== 'Completed' && <Button size="icon" variant="ghost" className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20" onClick={() => onTaskStart?.(task.id)}>
              <Play className="h-4 w-4" />
            </Button>}
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={cn("font-bold break-words", task.Progress === 'Completed' && "line-through text-gray-500")}>
              {task["Task Name"]}
            </span>
            {task.Progress !== 'Completed' && <span className="text-xs text-gray-500 flex items-center gap-1 whitespace-nowrap mt-1">
                <Clock className="h-3 w-3" />
                {format(new Date(task.date_started), 'M/d h:mm a')}
              </span>}
          </div>
        </div>
        {!isTaskView && task.Progress !== 'Completed' && <Button size="icon" variant="ghost" className="flex-shrink-0 h-8 w-8 rounded-full hover:bg-primary/10" onClick={() => setIsEditing(true)}>
            <PencilIcon className="h-4 w-4" />
          </Button>}
        {hasSubtasks && <Button size="icon" variant="ghost" className="flex-shrink-0 h-8 w-8 rounded-full hover:bg-primary/10" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>}
      </div>

      <EditTaskModal isOpen={isEditing} onClose={() => setIsEditing(false)} task={task} subtasks={subtasks} onSave={handleEditSave} />

      {isExpanded && hasSubtasks && <ul className="pl-6 space-y-2">
          {subtasks?.filter(subtask => subtask["Parent Task ID"] === task.id).sort((a, b) => {
        if (a.Progress === 'Completed' && b.Progress !== 'Completed') return 1;
        if (a.Progress !== 'Completed' && b.Progress === 'Completed') return -1;
        return 0;
      }).map(subtask => <li key={subtask.id} className={cn("flex items-start gap-3 p-3 rounded-lg bg-white/30 hover:bg-white/50 transition-colors")}>
                <Button size="icon" variant="ghost" className={cn("flex-shrink-0 h-6 w-6 rounded-full", subtask.Progress === 'Completed' ? "bg-green-500 text-white" : "bg-primary/10 text-primary hover:bg-primary/20")} onClick={() => updateTaskProgress.mutate({
          id: subtask.id,
          isSubtask: true
        })}>
                  <Check className="h-3 w-3" />
                </Button>
                <span className={cn("text-sm font-bold break-words", subtask.Progress === 'Completed' && "line-through text-gray-500")}>
                  {subtask["Task Name"]}
                </span>
              </li>)}
        </ul>}
    </li>;
};

const SortableTaskItem = ({
  task,
  children
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition
  } = useSortable({
    id: task.id
  });
  
  // Create a style object for transforms
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition || undefined
  };
  
  // Create a proper dragHandleProps object that is guaranteed to be a valid object
  const dragHandleProps = {};
  
  // Only add properties if they exist and are not undefined
  if (attributes) {
    Object.keys(attributes).forEach(key => {
      dragHandleProps[key] = attributes[key];
    });
  }
  
  if (listeners) {
    Object.keys(listeners).forEach(key => {
      dragHandleProps[key] = listeners[key];
    });
  }
  
  return (
    <div ref={setNodeRef} style={style}>
      {React.cloneElement(children, { dragHandleProps })}
    </div>
  );
};

export const TaskList: React.FC<TaskListProps> = ({
  tasks: initialTasks,
  onTaskStart,
  subtasks,
  taskLists,
  activeTaskId
}) => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const isTaskView = location.pathname === '/tasks';
  const sensors = useSensors(useSensor(MouseSensor, {
    activationConstraint: {
      distance: 10
    }
  }), useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5
    }
  }));

  const {
    data: dbTasks
  } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const today = new Date();
      const tomorrow3AM = addDays(today, 1);
      tomorrow3AM.setHours(3, 0, 0, 0);
      const {
        data,
        error
      } = await supabase.from('Tasks').select('*').order('date_started', {
        ascending: true
      });
      if (error) throw error;
      if (!isTaskView) {
        return data.filter(task => {
          const taskDate = task.date_started ? new Date(task.date_started) : null;
          if (!taskDate) return false;
          if (today.getHours() >= 21 || today.getHours() < 3) {
            const yesterday9PM = new Date(today);
            yesterday9PM.setDate(yesterday9PM.getDate() - 1);
            yesterday9PM.setHours(21, 0, 0, 0);
            return taskDate >= yesterday9PM && taskDate <= tomorrow3AM;
          }
          const today9PM = new Date(today);
          today9PM.setHours(21, 0, 0, 0);
          return taskDate <= tomorrow3AM;
        });
      }
      return data;
    }
  });

  const {
    data: todaySubtasks
  } = useQuery({
    queryKey: ['today-subtasks'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('subtasks').select('*').order('created_at', {
        ascending: true
      });
      if (error) throw error;
      return data;
    }
  });

  // Use the passed tasks prop for scheduler page, or dbTasks for task view
  const tasksToDisplay = !isTaskView && initialTasks ? initialTasks : dbTasks;

  const getTodayTasks = (tasks: any[]) => {
    if (!tasks || tasks.length === 0) return [];
    
    tasks = tasks.filter(task => task.Progress !== 'Backlog');
    
    const now = new Date();
    
    // Get current time in EST timezone using date-fns-tz
    const EST_TIMEZONE = 'America/New_York';
    const nowEST = new Date(now.toLocaleString("en-US", {timeZone: EST_TIMEZONE}));
    const estHour = nowEST.getHours();
    const isEveningMode = estHour >= 21 || estHour < 3;
    
    console.log('TaskList getTodayTasks:', {
      currentTime: now.toISOString(),
      estTime: nowEST.toISOString(),
      estHour,
      isEveningMode
    });
    
    if (isEveningMode) {
      // Evening mode: ONLY show current evening session (9 PM EST - 3 AM EST)
      let startTime: Date, endTime: Date;
      
      if (estHour >= 21) {
        // Currently after 9 PM - show from 9 PM today to 3 AM tomorrow
        startTime = new Date(nowEST);
        startTime.setHours(21, 0, 0, 0);
        
        endTime = new Date(nowEST);
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(3, 0, 0, 0);
      } else {
        // Currently before 3 AM - show from 9 PM yesterday to 3 AM today
        startTime = new Date(nowEST);
        startTime.setDate(startTime.getDate() - 1);
        startTime.setHours(21, 0, 0, 0);
        
        endTime = new Date(nowEST);
        endTime.setHours(3, 0, 0, 0);
      }
      
      // Use proper timezone conversion from EST to UTC
      const startTimeUTC = new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000);
      const endTimeUTC = new Date(endTime.getTime() - endTime.getTimezoneOffset() * 60000);
      
      console.log('Evening mode boundaries:', {
        sessionStartEST: startTime.toISOString(),
        sessionEndEST: endTime.toISOString(),
        sessionStartUTC: startTimeUTC.toISOString(),
        sessionEndUTC: endTimeUTC.toISOString()
      });
      
      const filteredTasks = tasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        
        // STRICT: Only include tasks within current evening session
        const isInSession = taskDate >= startTimeUTC && taskDate < endTimeUTC;
        
        if (isInSession) {
          console.log(`Including evening task: ${task["Task Name"]} at ${taskDate.toISOString()}`);
        }
        
        return isInSession;
      });
      
      console.log(`Evening mode filtered ${filteredTasks.length} tasks from ${tasks.length} total`);
      return filteredTasks;
    } else {
      // Normal mode: show only today's tasks (not tomorrow's)
      const todayEST = new Date(nowEST);
      todayEST.setHours(0, 0, 0, 0);
      
      const tomorrowEST = new Date(todayEST);
      tomorrowEST.setDate(tomorrowEST.getDate() + 1);
      
      // Convert to UTC properly
      const todayUTC = new Date(todayEST.getTime() - todayEST.getTimezoneOffset() * 60000);
      const tomorrowUTC = new Date(tomorrowEST.getTime() - tomorrowEST.getTimezoneOffset() * 60000);
      
      return tasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        return taskDate >= todayUTC && taskDate < tomorrowUTC;
      });
    }
  };

  const updateTaskOrderMutation = useMutation({
    mutationFn: async ({
      tasks,
      shouldResetTimer,
      movedTaskId
    }: {
      tasks: any[];
      shouldResetTimer: boolean;
      movedTaskId: number;
    }) => {
      const todayTasks = getTodayTasks(tasks);
      if (todayTasks.length === 0) return;
      
      const timeBlocks = todayTasks.filter(t => isTaskTimeBlock(t));
      const regularTasks = todayTasks.filter(t => !isTaskTimeBlock(t));
      
      const currentTask = regularTasks.find(t => isCurrentTask(t));
      const movedTask = regularTasks.find(t => t.id === movedTaskId);
      
      if (!movedTask) return;
      
      if (isTaskTimeBlock(movedTask)) {
        console.log('Skipping reordering for time block');
        return;
      }
      
      const currentTime = new Date();
      let nextStartTime = new Date(currentTime);
      
      if (currentTask) {
        nextStartTime = new Date(new Date(currentTask.date_due).getTime() + 5 * 60 * 1000);
      }
      
      timeBlocks.sort((a, b) => {
        const aStart = new Date(a.date_started).getTime();
        const bStart = new Date(b.date_started).getTime();
        return aStart - bStart;
      });
      
      const updates = [];
      
      for (const task of regularTasks) {
        if (task.Progress === 'Completed') continue;
        
        const taskIsCurrentTask = currentTask && task.id === currentTask.id;
        const isFirst = regularTasks.indexOf(task) === 0;
        let taskStartTime: Date;
        let taskEndTime: Date;
        
        if (taskIsCurrentTask) {
          taskStartTime = new Date(currentTask.date_started);
          taskEndTime = new Date(currentTask.date_due);
          console.log('Preserving current task time:', taskStartTime);
        } else {
          taskStartTime = new Date(nextStartTime);
          
          let needsRescheduling = true;
          while (needsRescheduling) {
            needsRescheduling = false;
            for (const timeBlock of timeBlocks) {
              const blockStart = new Date(timeBlock.date_started);
              const blockEnd = new Date(timeBlock.date_due);
              
              // Get task duration from details if available, default to 25 minutes
              let taskDuration = 25; // Default duration
              try {
                if (task.details) {
                  const details = typeof task.details === 'string' 
                    ? JSON.parse(task.details) 
                    : task.details;
                  
                  if (details && details.taskDuration && typeof details.taskDuration === 'number') {
                    taskDuration = details.taskDuration;
                  }
                }
              } catch (error) {
                console.error('Error parsing task details:', error);
              }
              
              const candidateEndTime = new Date(taskStartTime.getTime() + taskDuration * 60 * 1000);
              
              if (
                (taskStartTime >= blockStart && taskStartTime < blockEnd) ||
                (candidateEndTime > blockStart && candidateEndTime <= blockEnd) ||
                (taskStartTime <= blockStart && candidateEndTime >= blockEnd)
              ) {
                taskStartTime = new Date(blockEnd.getTime() + 5 * 60 * 1000);
                needsRescheduling = true;
                break;
              }
            }
          }
          
          // Get task duration from details if available, default to 25 minutes
          let taskDuration = 25; // Default duration
          try {
            if (task.details) {
              const details = typeof task.details === 'string' 
                ? JSON.parse(task.details) 
                : task.details;
              
              if (details && details.taskDuration && typeof details.taskDuration === 'number') {
                taskDuration = details.taskDuration;
              }
            }
          } catch (error) {
            console.error('Error parsing task details:', error);
          }
          
          taskEndTime = new Date(taskStartTime.getTime() + taskDuration * 60 * 1000);
          nextStartTime = new Date(taskEndTime.getTime() + 5 * 60 * 1000);
        }
        
        // Evening mode boundary validation - ensure tasks don't exceed 3 AM EST
        const EST_TIMEZONE = 'America/New_York';
        const currentTimeEST = new Date(currentTime.toLocaleString("en-US", {timeZone: EST_TIMEZONE}));
        const currentHourEST = currentTimeEST.getHours();
        const isEveningMode = currentHourEST >= 21 || currentHourEST < 3;
        
        if (isEveningMode) {
          // Calculate 3 AM EST boundary for current session
          let sessionEndEST: Date;
          if (currentHourEST >= 21) {
            // After 9 PM - session ends at 3 AM tomorrow
            sessionEndEST = new Date(currentTimeEST);
            sessionEndEST.setDate(sessionEndEST.getDate() + 1);
            sessionEndEST.setHours(3, 0, 0, 0);
          } else {
            // Before 3 AM - session ends at 3 AM today
            sessionEndEST = new Date(currentTimeEST);
            sessionEndEST.setHours(3, 0, 0, 0);
          }
          
          // Convert EST boundary to UTC for comparison
          const sessionEndUTC = new Date(sessionEndEST.getTime() - sessionEndEST.getTimezoneOffset() * 60000);
          
          // Skip tasks that would be scheduled beyond 3 AM EST
          if (taskEndTime > sessionEndUTC) {
            console.log(`Skipping task beyond 3 AM EST: ${task["Task Name"]} would end at ${taskEndTime.toISOString()}`);
            continue;
          }
        }
        
        // Store times as-is since they're already in the correct timezone context
        const taskStartTimeUTC = taskStartTime;
        const taskEndTimeUTC = taskEndTime;
        
        const updateData: any = {
          id: task.id,
          date_started: taskStartTimeUTC.toISOString(),
          date_due: taskEndTimeUTC.toISOString(),
          user_id: user?.id
        };
        
        if (shouldResetTimer && taskIsCurrentTask && !isFirst) {
          updateData.Progress = 'Not started';
        } else if (shouldResetTimer && isFirst && !taskIsCurrentTask) {
          updateData.Progress = 'In progress';
        }
        
        console.log('Updating task:', {
          taskName: task["Task Name"],
          startTime: taskStartTime,
          endTime: taskEndTime,
          isCurrentTask: taskIsCurrentTask,
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
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['active-tasks']
      });
      toast.success('Task schedule updated');
    },
    onError: error => {
      console.error('Error updating task schedule:', error);
      toast.error('Failed to update task schedule');
    }
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    console.log('handleDragEnd triggered:', { activeId: active.id, overId: over?.id });
    
    if (!over || active.id === over.id || !tasksToDisplay) {
      console.log('Drag end early return:', { hasOver: !!over, sameId: active.id === over?.id, hasTasksToDisplay: !!tasksToDisplay });
      return;
    }
    
    const todayTasks = tasksToDisplay || [];
    if (todayTasks.length === 0) return;
    
    const draggedTask = todayTasks.find(t => t.id === active.id);
    if (isTaskTimeBlock(draggedTask)) {
      toast.info("Time blocks can't be reordered");
      return;
    }
    
    const tasksWithoutTimeBlocks = todayTasks.filter(t => !isTaskTimeBlock(t));
    const timeBlocks = todayTasks.filter(t => isTaskTimeBlock(t));
    
    const oldIndex = tasksWithoutTimeBlocks.findIndex(t => t.id === active.id);
    const newIndex = tasksWithoutTimeBlocks.findIndex(t => t.id === over.id);
    
    const reorderedTasks = [...tasksWithoutTimeBlocks];
    const [movedTask] = reorderedTasks.splice(oldIndex, 1);
    reorderedTasks.splice(newIndex, 0, movedTask);
    
    const allTasks = [...reorderedTasks, ...timeBlocks];
    
    const currentTask = allTasks.find(t => t.Progress === 'In progress');
    const isMovingToFirst = newIndex === 0;
    const isMovingCurrentTask = currentTask && movedTask.id === currentTask.id;
    
    await updateTaskOrderMutation.mutate({
      tasks: allTasks,
      shouldResetTimer: isMovingToFirst || isMovingCurrentTask,
      movedTaskId: movedTask.id
    });
  };

  const updateTaskProgress = useMutation({
    mutationFn: async ({
      id,
      isSubtask = false
    }: {
      id: number;
      isSubtask?: boolean;
    }) => {
      const {
        error
      } = await supabase.from(isSubtask ? 'subtasks' : 'Tasks').update({
        Progress: 'Completed'
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['today-subtasks']
      });
      queryClient.invalidateQueries({
        queryKey: ['active-tasks']
      });
      toast.success('Task completed');
    }
  });

  if (!isTaskView) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-4 p-4 sm:p-6 animate-slideIn px-0" data-task-list>
        <h2 className="text-xl font-semibold">Today's Tasks</h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragStart={(e) => console.log('Drag started:', e.active.id)}>
          <SortableContext items={tasksToDisplay?.map(t => t.id) || []} strategy={verticalListSortingStrategy}>
            <ul className="space-y-4">
              {(tasksToDisplay || [])
                .filter(task => ['Not started', 'In progress'].includes(task.Progress))
                .map(task => (
                  <SortableTaskItem key={task.id} task={task}>
                    <TaskItem 
                      task={task} 
                      subtasks={todaySubtasks} 
                      updateTaskProgress={updateTaskProgress} 
                      onTaskStart={onTaskStart} 
                      isCurrentTask={task.id === activeTaskId}
                      taskLists={taskLists} 
                      updateTaskOrderMutation={updateTaskOrderMutation} // Pass the mutation down
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
    mutationFn: async ({
      taskId,
      startDate,
      endDate
    }: {
      taskId: number;
      startDate: Date;
      endDate: Date;
    }) => {
      const {
        error
      } = await supabase.from('Tasks').update({
        date_started: startDate.toISOString(),
        date_due: endDate.toISOString()
      }).eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['tasks']
      });
      toast.success('Task times updated');
    }
  });

  const updateRemainingTaskTimes = async () => {
    try {
      const notStartedTasks = tasksToDisplay?.filter(t => t.Progress === 'Not started') || [];
      if (notStartedTasks.length === 0) return;
      const currentTime = new Date();
      currentTime.setMinutes(currentTime.getMinutes() + 30);
      
      for (let i = 0; i < notStartedTasks.length; i++) {
        const task = notStartedTasks[i];
        const taskStartTime = new Date(currentTime);
        taskStartTime.setMinutes(taskStartTime.getMinutes() + i * 30);
        const taskDueTime = new Date(taskStartTime);
        taskDueTime.setMinutes(taskDueTime.getMinutes() + 25);
        const {
          error
        } = await supabase.from('Tasks').update({
          date_started: taskStartTime.toISOString(),
          date_due: taskDueTime.toISOString()
        }).eq('id', task.id);
        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating task times:', error);
      toast.error('Failed to update task times');
    }
  };

  const handleTaskStart = async (taskId: number) => {
    try {
      const { data: activeTasks, error } = await supabase
        .from('Tasks')
        .select('*')
        .in('Progress', ['Not started', 'In progress'])
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      if (!activeTasks || activeTasks.length === 0) {
        toast.error("No tasks available to start");
        return;
      }
      
      const selectedTask = activeTasks.find(t => t.id === taskId);
      if (!selectedTask) {
        toast.error("Task not found");
        return;
      }
      
      if (isTaskTimeBlock(selectedTask)) {
        toast.info("Time blocks can't be started as tasks");
        return;
      }
      
      const currentTime = new Date();
      const tomorrow5AM = new Date(currentTime);
      tomorrow5AM.setDate(tomorrow5AM.getDate() + 1);
      tomorrow5AM.setHours(5, 0, 0, 0);
      
      // Get task duration from details if available, default to 25 minutes
      let taskDuration = 25; // Default duration
      try {
        if (selectedTask.details) {
          const details = typeof selectedTask.details === 'string' 
            ? JSON.parse(selectedTask.details) 
            : selectedTask.details;
          
          if (details && details.taskDuration && typeof details.taskDuration === 'number') {
            taskDuration = details.taskDuration;
          }
        }
      } catch (error) {
        console.error('Error parsing task details:', error);
      }
      
      const taskToUpdate: Task = {
        id: selectedTask.id,
        "Task Name": selectedTask["Task Name"] || "",
        Progress: "In progress",
        task_list_id: selectedTask.task_list_id,
        project_id: selectedTask.project_id || null,
        date_started: currentTime.toISOString(),
        date_due: new Date(currentTime.getTime() + taskDuration * 60000).toISOString(),
        details: selectedTask.details
      };
      
      const { error: startError } = await supabase
        .from('Tasks')
        .update({
          Progress: taskToUpdate.Progress,
          date_started: taskToUpdate.date_started,
          date_due: taskToUpdate.date_due
        })
        .eq('id', taskId);
      
      if (startError) throw startError;
      
      const otherTasks = activeTasks
        .filter(t => {
          const taskDate = new Date(t.date_started);
          const isTaskFromTodayOrEarlier = isBefore(taskDate, tomorrow5AM);
          return t.id !== taskId && 
                 !isTaskTimeBlock(t) && 
                 t.Progress !== 'Backlog' &&
                 isTaskFromTodayOrEarlier;
        })
        .sort((a, b) => new Date(a.date_started).getTime() - new Date(b.date_started).getTime());
        
      let nextStartTime = new Date(currentTime.getTime() + taskDuration * 60000 + 5 * 60000);
      
      for (const task of otherTasks) {
        if (currentTime.getHours() >= 21 && isAfter(nextStartTime, tomorrow5AM)) {
          break;
        }
        
        const taskStartTime = new Date(nextStartTime);
        
        // Get task duration from details if available, default to 25 minutes
        let otherTaskDuration = 25; // Default duration
        try {
          if (task.details) {
            const details = typeof task.details === 'string' 
              ? JSON.parse(task.details) 
              : task.details;
            
            if (details && details.taskDuration && typeof details.taskDuration === 'number') {
              otherTaskDuration = details.taskDuration;
            }
          }
        } catch (error) {
          console.error('Error parsing task details:', error);
        }
        
        const taskEndTime = new Date(taskStartTime.getTime() + otherTaskDuration * 60000);
        
        const { error } = await supabase
          .from('Tasks')
          .update({
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString(),
            Progress: 'Not started'
          })
          .eq('id', task.id);
          
        if (error) throw error;
        
        nextStartTime = new Date(taskEndTime.getTime() + 5 * 60000);
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

  if (!tasksToDisplay || tasksToDisplay.length === 0) return null;

  const filteredTasks = tasksToDisplay.filter(task => {
    const matchesSearch = searchQuery ? task["Task Name"].toLowerCase().includes(searchQuery.toLowerCase()) : true;
    if (!isTaskView) {
      return task.Progress !== 'Completed' && matchesSearch;
    }
    const matchesFilter = filter === 'all' ? true : filter === 'active' ? task.Progress !== 'Completed' : task.Progress === 'Completed';
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
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
              onChange={e => setSearchQuery(e.target.value)} 
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary" 
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 shadow-sm">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredTasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-4">
              {filteredTasks.map(task => (
                <SortableTaskItem key={task.id} task={task}>
                  <TaskItem
                    task={task}
                    subtasks={todaySubtasks}
                    updateTaskProgress={updateTaskProgress}
                    onTaskStart={onTaskStart}
                    isCurrentTask={task.id === activeTaskId}
                    taskLists={taskLists}
                    updateTaskOrderMutation={updateTaskOrderMutation} // Pass the mutation down
                  />
                </SortableTaskItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
};
