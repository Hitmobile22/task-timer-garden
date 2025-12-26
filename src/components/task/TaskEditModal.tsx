import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Plus, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { SubtaskItem } from './SubtaskItem';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { RichTextEditor } from './editor/RichTextEditor';
import { Task } from '@/types/task.types';

interface TaskEditModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskLists?: any[]; // Make this prop optional
  onSave?: (task: Task) => void;
}

export const TaskEditModal = ({ task, open, onOpenChange, taskLists = [], onSave }: TaskEditModalProps) => {
  const { user } = useAuth();
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [descriptionContent, setDescriptionContent] = useState<any>(null);
  const [taskDuration, setTaskDuration] = useState<number>(25);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const queryClient = useQueryClient();

  // Query for subtask presets
  const { data: subtaskPresets } = useQuery({
    queryKey: ['subtask-presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtask_presets')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  useEffect(() => {
    if (task) {
      setEditedTask({ ...task });
      
      if (task.date_started) {
        setStartDate(new Date(task.date_started));
      } else {
        setStartDate(undefined);
      }
      
      if (task.date_due) {
        setDueDate(new Date(task.date_due));
      } else {
        setDueDate(undefined);
      }
      
      // Parse details and extract taskDuration if available
      try {
        let details = null;
        if (task.details) {
          // Handle both string and object formats
          details = typeof task.details === 'string' 
            ? JSON.parse(task.details) 
            : task.details;
            
          if (details && typeof details === 'object' && 'taskDuration' in details) {
            setTaskDuration(details.taskDuration || 25);
          } else {
            // Calculate task duration from start and due dates if available
            if (task.date_started && task.date_due) {
              const start = new Date(task.date_started);
              const end = new Date(task.date_due);
              const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
              setTaskDuration(durationMinutes > 0 ? durationMinutes : 25);
            } else {
              setTaskDuration(25);
            }
          }
        } else {
          setTaskDuration(25);
        }
        
        // Handle description content
        if (details && details.description && isValidContent(details.description)) {
          console.log("Setting valid description content:", details.description);
          setDescriptionContent(details.description);
        } else {
          console.log("Setting empty description content");
          setDescriptionContent({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: " " // Non-empty space to prevent errors
                  }
                ]
              }
            ]
          });
        }
      } catch (error) {
        console.error("Error initializing task details:", error);
        setTaskDuration(25);
        setDescriptionContent({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: " " // Non-empty space to prevent errors
                }
              ]
            }
          ]
        });
      }
      
      fetchSubtasks(task.id);
    }
  }, [task]);

  const isValidContent = (content: any): boolean => {
    try {
      if (!content || typeof content !== 'object') return false;
      if (content.type !== 'doc') return false;
      if (!Array.isArray(content.content)) return false;
      
      if (content.content.length === 0) return true;
      
      return true;
    } catch (error) {
      console.error("Error validating content:", error);
      return false;
    }
  };

  const fetchSubtasks = async (taskId: number) => {
    try {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('Parent Task ID', taskId)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
        
      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error('Error fetching subtasks:', error);
      toast.error('Failed to load subtasks');
    }
  };

  const rescheduleSubsequentTasks = async (updatedTask: Task, originalDuration: number, newDuration: number) => {
    try {
      if (!updatedTask.date_started || originalDuration === newDuration) return;

      // Get all active tasks that come after this task
      const { data: allTasks, error } = await supabase
        .from('Tasks')
        .select('*')
        .in('Progress', ['Not started', 'In progress'])
        .neq('Progress', 'Backlog')
        .order('date_started', { ascending: true });

      if (error) throw error;

      const currentTaskStart = new Date(updatedTask.date_started);
      const tasksToReschedule = allTasks.filter(t => 
        t.id !== updatedTask.id && 
        t.date_started &&
        new Date(t.date_started) > currentTaskStart
      );

      if (tasksToReschedule.length === 0) return;

      const timeDifference = (newDuration - originalDuration) * 60 * 1000; // Convert to milliseconds

      // Update each subsequent task
      for (const task of tasksToReschedule) {
        const newStartTime = new Date(new Date(task.date_started).getTime() + timeDifference);
        const newEndTime = new Date(new Date(task.date_due).getTime() + timeDifference);

        await supabase
          .from('Tasks')
          .update({
            date_started: newStartTime.toISOString(),
            date_due: newEndTime.toISOString()
          })
          .eq('id', task.id);
      }

      console.log(`Rescheduled ${tasksToReschedule.length} subsequent tasks by ${timeDifference / 60000} minutes`);
    } catch (error) {
      console.error('Error rescheduling subsequent tasks:', error);
      toast.error('Failed to reschedule subsequent tasks');
    }
  };

  const handleSave = async () => {
    try {
      if (!editedTask) return;

      // Get original duration for rescheduling calculation
      let originalDuration = 25;
      try {
        if (task?.date_started && task?.date_due) {
          // Calculate from actual timestamps (source of truth for ORIGINAL duration)
          const start = new Date(task.date_started);
          const end = new Date(task.date_due);
          originalDuration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
        } else if (task?.details) {
          // Fallback to details only if dates don't exist
          const details = typeof task.details === 'string' ? JSON.parse(task.details) : task.details;
          originalDuration = details?.taskDuration || 25;
        }
      } catch (error) {
        console.error("Error getting original duration:", error);
      }

      // Calculate end time based on start time and task duration
      let updatedDueDate = dueDate;
      if (startDate) {
        updatedDueDate = new Date(startDate.getTime() + taskDuration * 60 * 1000);
      }
      
      // Make sure we properly handle the details object
      let updatedDetails: Record<string, any> = {};
      try {
        // Start with existing details or empty object
        if (editedTask.details) {
          if (typeof editedTask.details === 'string') {
            try {
              const parsedDetails = JSON.parse(editedTask.details);
              if (parsedDetails && typeof parsedDetails === 'object') {
                updatedDetails = parsedDetails;
              }
            } catch (e) {
              // If parsing fails, start with empty object
              updatedDetails = {};
            }
          } else if (typeof editedTask.details === 'object' && editedTask.details !== null) {
            updatedDetails = { ...editedTask.details };
          }
        }
        
        // Update with new values
        updatedDetails = {
          ...updatedDetails,
          description: descriptionContent || null,
          taskDuration: taskDuration // Store the task duration in the details JSON
        };
      } catch (error) {
        console.error("Error processing task details:", error);
        updatedDetails = {
          description: descriptionContent || null,
          taskDuration: taskDuration
        };
      }
      
      const updatedTask = {
        ...editedTask,
        date_started: startDate ? startDate.toISOString() : null,
        date_due: updatedDueDate ? updatedDueDate.toISOString() : null,
        details: updatedDetails
      };

      console.log("Saving task with duration:", taskDuration, "minutes");
      console.log("Task start:", updatedTask.date_started);
      console.log("Task end:", updatedTask.date_due);
      console.log("Task details:", updatedDetails);
      
      const { error } = await supabase
        .from('Tasks')
        .update(updatedTask)
        .eq('id', updatedTask.id);
        
      if (error) throw error;

      // Reschedule subsequent tasks if duration changed
      if (originalDuration !== taskDuration) {
        await rescheduleSubsequentTasks(updatedTask, originalDuration, taskDuration);
      }
      
      // Invalidate all relevant queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', updatedTask.id] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      
      if (onSave) {
        onSave(updatedTask);
      }
      
      toast.success('Task updated successfully');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  };

  const handleAddSubtask = async () => {
    try {
      if (!newSubtask.trim() || !editedTask) return;
      
      // Calculate next sort_order based on existing subtasks
      const nextSortOrder = subtasks.length > 0 
        ? Math.max(...subtasks.map(s => s.sort_order || 0)) + 1 
        : 0;
      
      const { data, error } = await supabase
        .from('subtasks')
        .insert([
          { 
            'Task Name': newSubtask, 
            'Parent Task ID': editedTask.id,
            'Progress': 'Not started' as const,
            'user_id': user?.id,
            'sort_order': nextSortOrder
          }
        ])
        .select();
        
      if (error) throw error;
      
      setSubtasks([...subtasks, ...data]);
      setNewSubtask('');
      
      toast.success('Subtask added');
    } catch (error) {
      console.error('Error adding subtask:', error);
      toast.error('Failed to add subtask');
    }
  };

  const handleUpdateSubtask = async (subtaskId: number, progress: Task['Progress']) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .update({ Progress: progress })
        .eq('id', subtaskId);
        
      if (error) throw error;
      
      setSubtasks(subtasks.map(s => s.id === subtaskId ? { ...s, Progress: progress } : s));
      toast.success('Subtask updated');
    } catch (error) {
      console.error('Error updating subtask:', error);
      toast.error('Failed to update subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId: number) => {
    try {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId);
        
      if (error) throw error;
      
      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
      toast.success('Subtask deleted');
    } catch (error) {
      console.error('Error deleting subtask:', error);
      toast.error('Failed to delete subtask');
    }
  };

  const handleDescriptionChange = (content: any) => {
    try {
      console.log("New description content:", content);
      setDescriptionContent(content);
    } catch (error) {
      console.error("Error handling description change:", error);
    }
  };
  
  const incrementTaskDuration = () => {
    setTaskDuration(prev => prev + 5);
  };
  
  const decrementTaskDuration = () => {
    setTaskDuration(prev => prev > 5 ? prev - 5 : 5);
  };

  const handleApplyPreset = async (presetId: string) => {
    try {
      if (!presetId || !editedTask) return;
      
      const preset = subtaskPresets?.find(p => p.id.toString() === presetId);
      if (!preset || !preset.subtask_names || preset.subtask_names.length === 0) {
        toast.error('Invalid preset selected');
        return;
      }

      // Calculate starting sort_order
      const maxSortOrder = subtasks.length > 0 
        ? Math.max(...subtasks.map(s => s.sort_order || 0)) 
        : -1;

      // Insert all subtasks from the preset
      const newSubtasks = preset.subtask_names.map((name: string, index: number) => ({
        'Task Name': name,
        'Parent Task ID': editedTask.id,
        'Progress': 'Not started' as const,
        'user_id': user?.id,
        'sort_order': maxSortOrder + 1 + index,
      }));

      const { data, error } = await supabase
        .from('subtasks')
        .insert(newSubtasks)
        .select();

      if (error) throw error;

      setSubtasks([...subtasks, ...(data || [])]);
      setSelectedPresetId('');
      toast.success(`Added ${preset.subtask_names.length} subtasks from preset "${preset.name}"`);
    } catch (error) {
      console.error('Error applying preset:', error);
      toast.error('Failed to apply preset');
    }
  };

  if (!editedTask) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="subtasks">Subtasks</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Task Name</Label>
              <Input 
                id="name" 
                value={editedTask?.["Task Name"] || ''} 
                onChange={(e) => setEditedTask({...editedTask, "Task Name": e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taskList">Task List</Label>
              <Select
                value={editedTask.task_list_id?.toString() || ''}
                onValueChange={(value) => setEditedTask({...editedTask, task_list_id: parseInt(value)})}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a task list" />
                </SelectTrigger>
                <SelectContent>
                  {taskLists?.map((list) => (
                    <SelectItem 
                      key={list.id} 
                      value={list.id.toString()}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            backgroundColor: list.color || 'gray'
                          }} 
                        />
                        {list.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="p-4 space-y-4">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          if (date) {
                            const newDate = new Date(date);
                            if (startDate) {
                              newDate.setHours(startDate.getHours());
                              newDate.setMinutes(startDate.getMinutes());
                            } else {
                              newDate.setHours(new Date().getHours());
                              newDate.setMinutes(new Date().getMinutes());
                            }
                            setStartDate(newDate);
                          }
                        }}
                        initialFocus
                        className="pointer-events-auto"
                      />
                      <div className="flex gap-2 items-center">
                        <Input 
                          type="time" 
                          value={startDate ? format(startDate, "HH:mm") : ""} 
                          onChange={e => {
                            if (startDate && e.target.value) {
                              const [hours, minutes] = e.target.value.split(':').map(Number);
                              const newDate = new Date(startDate);
                              newDate.setHours(hours);
                              newDate.setMinutes(minutes);
                              setStartDate(newDate);
                            }
                          }}
                          className="pointer-events-auto"
                        />
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>Task Time (minutes)</Label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={decrementTaskDuration} 
                    disabled={taskDuration <= 5}
                    className="flex-shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  
                  <Input
                    type="number"
                    value={taskDuration}
                    min={5}
                    onChange={e => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 5) {
                        setTaskDuration(value);
                      }
                    }}
                    className="text-center"
                  />
                  
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={incrementTaskDuration}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Progress</Label>
              <RadioGroup 
                value={editedTask.Progress} 
                onValueChange={(value: Task['Progress']) => setEditedTask({...editedTask, Progress: value})}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Not started" id="not-started" />
                  <Label htmlFor="not-started">Not Started</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="In progress" id="in-progress" />
                  <Label htmlFor="in-progress">In Progress</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Completed" id="completed" />
                  <Label htmlFor="completed">Completed</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Backlog" id="backlog" />
                  <Label htmlFor="backlog">Backlog</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div className="space-y-2">
              <Label>Time Block</Label>
              <RadioGroup 
                value={editedTask.IsTimeBlock || 'No'} 
                onValueChange={(value: 'Yes' | 'No') => setEditedTask({...editedTask, IsTimeBlock: value})}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="No" id="not-timeblock" />
                  <Label htmlFor="not-timeblock">Regular Task</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Yes" id="is-timeblock" />
                  <Label htmlFor="is-timeblock">Time Block</Label>
                </div>
              </RadioGroup>
              {editedTask.IsTimeBlock === 'Yes' && (
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  Time blocks are protected calendar events
                </Badge>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="description" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Task Description</Label>
              <div className="border rounded-md">
                {descriptionContent !== null && (
                  <RichTextEditor 
                    initialContent={descriptionContent}
                    onChange={handleDescriptionChange}
                    editable={true}
                  />
                )}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="subtasks" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Preset Dropdown */}
              {subtaskPresets && subtaskPresets.length > 0 && (
                <div className="space-y-2">
                  <Label>Apply a Subtask Preset</Label>
                  <Select
                    value={selectedPresetId}
                    onValueChange={(value) => {
                      setSelectedPresetId(value);
                      handleApplyPreset(value);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a preset to add subtasks..." />
                    </SelectTrigger>
                    <SelectContent>
                      {subtaskPresets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id.toString()}>
                          {preset.name} ({preset.subtask_names?.length || 0} subtasks)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Subtasks</Label>
                <div className="space-y-2">
                  {subtasks.map((subtask) => (
                    <SubtaskItem 
                      key={subtask.id}
                      subtask={subtask}
                      onUpdateProgress={(progress) => {
                        if (typeof progress === 'string') {
                          handleUpdateSubtask(subtask.id, progress as Task['Progress']);
                        }
                      }}
                      onDelete={() => handleDeleteSubtask(subtask.id)}
                    />
                  ))}
                </div>
                
                <div className="flex items-center space-x-2 mt-4">
                  <Input 
                    placeholder="Add a new subtask" 
                    value={newSubtask} 
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddSubtask();
                      }
                    }}
                  />
                  <Button onClick={handleAddSubtask}>Add</Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
