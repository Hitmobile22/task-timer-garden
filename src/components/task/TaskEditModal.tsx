
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { SubtaskItem } from './SubtaskItem';
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { RichTextEditor } from './editor/RichTextEditor';
import { Task } from '@/types/task.types';

interface TaskEditModalProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (task: Task) => void;
}

export const TaskEditModal = ({ task, open, onOpenChange, onSave }: TaskEditModalProps) => {
  const [editedTask, setEditedTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<any[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [activeTab, setActiveTab] = useState('general');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [descriptionContent, setDescriptionContent] = useState<any>(null);
  const queryClient = useQueryClient();

  // Initialize form with task data
  useEffect(() => {
    if (task) {
      setEditedTask({ ...task });
      
      // Handle dates
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
      
      // Initialize description content safely
      try {
        if (task.details?.description) {
          // Validate content before setting it
          const content = task.details.description;
          if (isValidContent(content)) {
            setDescriptionContent(content);
          } else {
            // If content is invalid, set a valid default
            setDescriptionContent({
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: task.details.description?.content?.[0]?.content?.[0]?.text || ""
                    }
                  ]
                }
              ]
            });
          }
        } else {
          // Set empty valid content
          setDescriptionContent({
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  {
                    type: "text",
                    text: ""
                  }
                ]
              }
            ]
          });
        }
      } catch (error) {
        console.error("Error initializing description content:", error);
        // Fallback to empty valid content
        setDescriptionContent({
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: ""
                }
              ]
            }
          ]
        });
      }
      
      // Load subtasks
      fetchSubtasks(task.id);
    }
  }, [task]);

  // Helper function to validate content structure
  const isValidContent = (content: any): boolean => {
    try {
      if (!content || typeof content !== 'object') return false;
      if (content.type !== 'doc') return false;
      if (!Array.isArray(content.content)) return false;
      
      // Check each paragraph
      return content.content.every((paragraph: any) => {
        if (!paragraph || typeof paragraph !== 'object') return false;
        if (paragraph.type !== 'paragraph') return false;
        if (!Array.isArray(paragraph.content)) return false;
        
        // Check text nodes
        return paragraph.content.every((textNode: any) => {
          if (!textNode || typeof textNode !== 'object') return false;
          if (textNode.type !== 'text') return false;
          if (typeof textNode.text !== 'string') return false;
          // Empty text is not allowed, so ensure there's at least one character
          // or the node doesn't exist
          return textNode.text.length > 0;
        });
      });
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
        .order('id', { ascending: true });
        
      if (error) throw error;
      setSubtasks(data || []);
    } catch (error) {
      console.error('Error fetching subtasks:', error);
      toast.error('Failed to load subtasks');
    }
  };

  const handleSave = async () => {
    try {
      if (!editedTask) return;
      
      // Prepare task data
      const updatedTask = {
        ...editedTask,
        date_started: startDate ? startDate.toISOString() : null,
        date_due: dueDate ? dueDate.toISOString() : null,
        details: {
          ...editedTask.details,
          description: descriptionContent || null
        }
      };
      
      // Update task in database
      const { error } = await supabase
        .from('Tasks')
        .update(updatedTask)
        .eq('id', updatedTask.id);
        
      if (error) throw error;
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', updatedTask.id] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      
      // Call onSave callback if provided
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
      
      const { data, error } = await supabase
        .from('subtasks')
        .insert([
          { 
            'Task Name': newSubtask, 
            'Parent Task ID': editedTask.id,
            'Progress': 'Not started'
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

  const handleUpdateSubtask = async (subtaskId: number, progress: string) => {
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
      // Validate content before setting
      if (content && isValidContent(content)) {
        setDescriptionContent(content);
      } else {
        console.warn("Invalid editor content received, using fallback");
        // Use fallback valid content
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
      console.error("Error handling description change:", error);
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
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dueDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Progress</Label>
              <RadioGroup 
                value={editedTask.Progress || 'Not started'} 
                onValueChange={(value) => setEditedTask({...editedTask, Progress: value})}
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
                onValueChange={(value) => setEditedTask({...editedTask, IsTimeBlock: value})}
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
            <div className="space-y-2">
              <Label>Subtasks</Label>
              <div className="space-y-2">
                {subtasks.map((subtask) => (
                  <SubtaskItem 
                    key={subtask.id}
                    subtask={subtask}
                    onUpdateProgress={(progress) => handleUpdateSubtask(subtask.id, progress)}
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
