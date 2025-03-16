
import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Goal, Plus, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Task, ProjectGoal } from '@/types/task.types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProjectGoalForm } from './ProjectGoalForm';
import { ProjectGoalsList } from './ProjectGoalsList';

interface ProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (projectData: any) => void;
  taskLists: any[];
  availableTasks: Task[];
  initialData?: {
    id?: number;
    name: string;
    startDate?: Date;
    dueDate?: Date;
    status: string;
    taskListId?: number;
    selectedTasks?: number[];
    isRecurring?: boolean;
    recurringTaskCount?: number;
  };
}

// Array of daily task count options (1-10)
const DAILY_TASK_COUNT_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

export const ProjectModal: React.FC<ProjectModalProps> = ({
  open,
  onClose,
  onSubmit,
  taskLists,
  availableTasks,
  initialData,
}) => {
  const [name, setName] = React.useState(initialData?.name || "");
  const [selectedTasks, setSelectedTasks] = React.useState<number[]>(initialData?.selectedTasks || []);
  const [startDate, setStartDate] = React.useState<Date | undefined>(initialData?.startDate);
  const [dueDate, setDueDate] = React.useState<Date | undefined>(initialData?.dueDate);
  const [status, setStatus] = React.useState(initialData?.status || "Not started");
  const [taskListId, setTaskListId] = React.useState(initialData?.taskListId?.toString() || "");
  const [isRecurring, setIsRecurring] = React.useState(initialData?.isRecurring || false);
  const [recurringTaskCount, setRecurringTaskCount] = React.useState(initialData?.recurringTaskCount || 1);
  const [startDateOpen, setStartDateOpen] = React.useState(false);
  const [dueDateOpen, setDueDateOpen] = React.useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [isGoalsEnabled, setIsGoalsEnabled] = useState(false);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ProjectGoal | null>(null);
  
  const queryClient = useQueryClient();
  
  // Fetch project goals if we have a project ID
  const { data: projectGoals = [], isLoading: isLoadingGoals } = useQuery({
    queryKey: ['project-goals', initialData?.id],
    queryFn: async () => {
      if (!initialData?.id) return [];
      
      const { data, error } = await supabase
        .from('project_goals')
        .select('*')
        .eq('project_id', initialData.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ProjectGoal[];
    },
    enabled: !!initialData?.id && open,
  });

  // Update goals enabled state based on whether there are any goals
  useEffect(() => {
    if (projectGoals && projectGoals.length > 0) {
      setIsGoalsEnabled(true);
    }
  }, [projectGoals]);

  // Create goal mutation
  const createGoalMutation = useMutation({
    mutationFn: async (goalData: Partial<ProjectGoal>) => {
      // Fix: Make sure required fields are present
      if (!goalData.goal_type || !goalData.project_id || !goalData.start_date) {
        throw new Error("Missing required goal data");
      }
      
      const { data, error } = await supabase
        .from('project_goals')
        .insert([goalData]) // Fix: Wrap single object in array
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals', initialData?.id] });
      toast.success('Goal created successfully');
      setIsAddingGoal(false);
      setEditingGoal(null);
    },
    onError: (error) => {
      console.error('Error creating goal:', error);
      toast.error('Failed to create goal');
    }
  });

  // Update goal mutation
  const updateGoalMutation = useMutation({
    mutationFn: async (goalData: Partial<ProjectGoal>) => {
      if (!goalData.id) {
        throw new Error("Missing goal ID for update");
      }
      
      const { data, error } = await supabase
        .from('project_goals')
        .update(goalData)
        .eq('id', goalData.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals', initialData?.id] });
      toast.success('Goal updated successfully');
      setIsAddingGoal(false);
      setEditingGoal(null);
    },
    onError: (error) => {
      console.error('Error updating goal:', error);
      toast.error('Failed to update goal');
    }
  });

  // Delete goal mutation
  const deleteGoalMutation = useMutation({
    mutationFn: async (goalId: number) => {
      const { error } = await supabase
        .from('project_goals')
        .delete()
        .eq('id', goalId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals', initialData?.id] });
      toast.success('Goal deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting goal:', error);
      toast.error('Failed to delete goal');
    }
  });

  // Handle saving goal
  const handleSaveGoal = (goalData: Partial<ProjectGoal>) => {
    if (editingGoal?.id) {
      updateGoalMutation.mutate(goalData);
    } else {
      createGoalMutation.mutate(goalData);
    }
  };

  // Handle editing a goal
  const handleEditGoal = (goal: ProjectGoal) => {
    setEditingGoal(goal);
    setIsAddingGoal(true);
  };

  // Handle deleting a goal
  const handleDeleteGoal = (goalId: number) => {
    if (window.confirm('Are you sure you want to delete this goal?')) {
      deleteGoalMutation.mutate(goalId);
    }
  };

  // Update form state when initialData changes
  useEffect(() => {
    if (initialData) {
      console.log("ProjectModal: Updating form with initialData:", initialData);
      setName(initialData.name || "");
      setSelectedTasks(initialData.selectedTasks || []);
      setStartDate(initialData.startDate);
      setDueDate(initialData.dueDate);
      setStatus(initialData.status || "Not started");
      setTaskListId(initialData.taskListId?.toString() || "");
      setIsRecurring(initialData.isRecurring || false);
      setRecurringTaskCount(initialData.recurringTaskCount || 1);
    } else {
      // Reset form for new project
      handleReset();
    }
  }, [initialData, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("ProjectModal: Submitting form with data:", {
      id: initialData?.id,
      name,
      selectedTasks,
      startDate,
      dueDate,
      status,
      taskListId: taskListId ? parseInt(taskListId) : undefined,
      isRecurring,
      recurringTaskCount,
    });
    
    onSubmit({
      id: initialData?.id,
      name,
      selectedTasks,
      startDate,
      dueDate,
      status,
      taskListId: taskListId ? parseInt(taskListId) : undefined,
      isRecurring,
      recurringTaskCount,
    });
  };

  const handleReset = () => {
    setName("");
    setSelectedTasks([]);
    setStartDate(undefined);
    setDueDate(undefined);
    setStatus("Not started");
    setTaskListId("");
    setIsRecurring(false);
    setRecurringTaskCount(1);
    setActiveTab("details");
    setIsGoalsEnabled(false);
    setIsAddingGoal(false);
    setEditingGoal(null);
  };

  // Set default dates when opening date pickers
  const handleStartDateOpenChange = (open: boolean) => {
    setStartDateOpen(open);
    if (open && !startDate) {
      // Set today's date as default for start date
      setStartDate(new Date());
    }
  };

  const handleDueDateOpenChange = (open: boolean) => {
    setDueDateOpen(open);
    if (open && !dueDate) {
      // If start date is selected, use that as default for due date, otherwise use today
      setDueDate(startDate ? new Date(startDate) : new Date());
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData?.id ? 'Edit Project' : 'Create New Project'}</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="details" className="flex-1">Project Details</TabsTrigger>
            <TabsTrigger 
              value="goals" 
              className="flex-1"
              disabled={!initialData?.id}
            >
              Goals
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="mt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter project name"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tasks</label>
                <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-md p-2">
                  {availableTasks.map((task) => (
                    <div key={task.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`task-${task.id}`}
                        checked={selectedTasks.includes(task.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedTasks([...selectedTasks, task.id]);
                          } else {
                            setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                          }
                        }}
                      />
                      <label htmlFor={`task-${task.id}`} className="text-sm">
                        {task["Task Name"]}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Start Date</label>
                  <Popover open={startDateOpen} onOpenChange={handleStartDateOpenChange}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
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
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => {
                          setStartDate(date);
                          setStartDateOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Due Date</label>
                  <Popover open={dueDateOpen} onOpenChange={handleDueDateOpenChange}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
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
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dueDate}
                        onSelect={(date) => {
                          setDueDate(date);
                          setDueDateOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="recurring-project" className="text-sm font-medium">Recurring Project</Label>
                  <Switch
                    id="recurring-project"
                    checked={isRecurring}
                    onCheckedChange={setIsRecurring}
                  />
                </div>
                
                {isRecurring && (
                  <div className="pl-4 pt-2 space-y-2">
                    <Label htmlFor="daily-task-count" className="text-sm font-medium">Daily Task Count</Label>
                    <Select
                      value={recurringTaskCount.toString()}
                      onValueChange={(value) => setRecurringTaskCount(Number(value) || 1)}
                      disabled={!isRecurring}
                    >
                      <SelectTrigger id="daily-task-count" className="w-full">
                        <SelectValue placeholder="Select daily task count" />
                      </SelectTrigger>
                      <SelectContent>
                        {DAILY_TASK_COUNT_OPTIONS.map((count) => (
                          <SelectItem key={count} value={count.toString()}>
                            {count}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Tasks will be generated daily between start and due dates.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Not started">Not started</SelectItem>
                    <SelectItem value="In progress">In progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Task List</label>
                <Select value={taskListId} onValueChange={setTaskListId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task list" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskLists.map((list) => (
                      <SelectItem key={list.id} value={list.id.toString()}>
                        {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">{initialData?.id ? 'Update' : 'Create'} Project</Button>
              </DialogFooter>
            </form>
          </TabsContent>
          
          <TabsContent value="goals" className="mt-4 space-y-4">
            {!initialData?.id ? (
              <div className="text-center p-4">
                <p>Please save the project first to add goals.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <h3 className="text-lg font-medium">Project Goals</h3>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enable-goals"
                      checked={isGoalsEnabled}
                      onCheckedChange={setIsGoalsEnabled}
                    />
                    <Label htmlFor="enable-goals" className="text-sm">Enable Goals</Label>
                  </div>
                </div>
                
                {isGoalsEnabled && (
                  <div className="space-y-4">
                    {isAddingGoal || editingGoal ? (
                      <ProjectGoalForm
                        projectId={initialData?.id}
                        existingGoal={editingGoal || undefined}
                        onSave={handleSaveGoal}
                        onCancel={() => {
                          setIsAddingGoal(false);
                          setEditingGoal(null);
                        }}
                      />
                    ) : (
                      <>
                        <Button 
                          className="w-full" 
                          variant="outline"
                          onClick={() => setIsAddingGoal(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add New Goal
                        </Button>
                        
                        <ProjectGoalsList
                          goals={projectGoals}
                          onEdit={handleEditGoal}
                          onDelete={handleDeleteGoal}
                        />
                      </>
                    )}
                  </div>
                )}
                
                {!isAddingGoal && !editingGoal && (
                  <DialogFooter>
                    <Button type="button" onClick={onClose}>
                      Close
                    </Button>
                  </DialogFooter>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
