
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Plus, Repeat, ListFilter, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProjectGoalsList } from './ProjectGoalsList';
import { GoalForm } from '../goals/GoalForm';
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox"; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Goal } from '@/types/goals.types';

interface ProjectModalProps {
  project?: any;
  onClose: () => void;
  onUpdateProject: (project: any) => void;
  projType?: string;
  open: boolean;
  taskLists: Array<{id: number, name: string, color?: string}>;
}

export const ProjectModal = ({ 
  project = null, 
  onClose, 
  onUpdateProject, 
  projType = 'create',
  open = false,
  taskLists = [] // Default value to ensure it's always an array
}: ProjectModalProps) => {
  const [editMode, setEditMode] = useState(projType === 'create');
  const [projectName, setProjectName] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [dateStarted, setDateStarted] = useState<Date | undefined>(undefined);
  const [dateDue, setDateDue] = useState<Date | undefined>(undefined);
  const [progress, setProgress] = useState<'Not started' | 'In progress' | 'Completed' | 'Backlog'>('Not started');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringTaskCount, setRecurringTaskCount] = useState(1);
  const [isLoadingGoals, setIsLoadingGoals] = useState(false);
  const [taskListId, setTaskListId] = useState<number | null>(null);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'tasks' | 'goals'>('details');
  
  useEffect(() => {
    if (taskLists.length > 0 && !taskListId) {
      setTaskListId(taskLists[0].id);
    }
  }, [taskLists, taskListId]);

  useEffect(() => {
    loadAvailableTasks();
  }, []);
  
  useEffect(() => {
    if (project) {
      console.log("Project data loaded:", project);
      
      setProjectName(project['Project Name'] || project.name || '');
      setProjectNotes(''); // Initialize with empty string since notes column doesn't exist
      setProgress((project.progress || project.status || 'Not started') as 'Not started' | 'In progress' | 'Completed' | 'Backlog');
      setIsRecurring(project.isRecurring || false);
      setRecurringTaskCount(project.recurringTaskCount || 1);
      setTaskListId(project.task_list_id || taskLists[0]?.id);
      
      if (project.date_started) {
        setDateStarted(new Date(project.date_started));
      } else if (project.startDate) {
        if (typeof project.startDate === 'object' && project.startDate?._type === 'Date') {
          setDateStarted(new Date(project.startDate.value.iso));
        } else {
          setDateStarted(new Date(project.startDate));
        }
      } else {
        setDateStarted(undefined);
      }
      
      if (project.date_due) {
        setDateDue(new Date(project.date_due));
      } else if (project.dueDate) {
        if (typeof project.dueDate === 'object' && project.dueDate?._type === 'Date') {
          setDateDue(new Date(project.dueDate.value.iso));
        } else {
          setDateDue(new Date(project.dueDate));
        }
      } else {
        setDateDue(undefined);
      }
      
      if (project.selectedTasks) {
        setSelectedTasks(project.selectedTasks);
      } else {
        loadProjectTasks(project.id);
      }
      
      loadProjectGoals(project.id);
    } else {
      setEditMode(true);
      setProjectName('');
      setProjectNotes('');
      setDateStarted(undefined);
      setDateDue(undefined);
      setProgress('Not started');
      setIsRecurring(false);
      setRecurringTaskCount(1);
      setTaskListId(taskLists[0]?.id || null);
      setSelectedTasks([]);
      setGoals([]);
    }
  }, [project, taskLists]);
  
  const loadAvailableTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .eq('archived', false);
        
      if (error) {
        console.error("Error loading tasks:", error);
        toast.error("Failed to load available tasks");
      } else {
        setAvailableTasks(data || []);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load available tasks");
    }
  };
  
  const loadProjectTasks = async (projectId: number) => {
    if (!projectId) return;
    
    try {
      const { data, error } = await supabase
        .from('Tasks')
        .select('id')
        .eq('project_id', projectId)
        .eq('archived', false);
        
      if (error) {
        console.error("Error loading project tasks:", error);
        toast.error("Failed to load project tasks");
      } else {
        setSelectedTasks(data?.map(t => t.id) || []);
      }
    } catch (error) {
      console.error("Error loading project tasks:", error);
      toast.error("Failed to load project tasks");
    }
  };
  
  const loadProjectGoals = async (projectId: number) => {
    if (!projectId) return;
    
    setIsLoadingGoals(true);
    try {
      const { data, error } = await supabase
        .from('project_goals')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
        
      if (error) {
        console.error("Error loading goals:", error);
        toast.error("Failed to load project goals");
      } else {
        console.log("Loaded project goals:", data);
        setGoals(data || []);
      }
    } catch (error) {
      console.error("Error loading goals:", error);
      toast.error("Failed to load project goals");
    } finally {
      setIsLoadingGoals(false);
    }
  };
  
  const handleEditGoal = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsGoalFormOpen(true);
  };
  
  const handleDeleteGoal = async (goalId: number) => {
    if (!project?.id) {
      toast.error("Project ID is missing.");
      return;
    }
    
    try {
      const { error } = await supabase.from('project_goals').delete().eq('id', goalId);
      
      if (error) {
        console.error("Error deleting goal:", error);
        toast.error("Failed to delete goal.");
      } else {
        setGoals((currentGoals) => currentGoals.filter((goal) => goal.id !== goalId));
        
        toast.success("Goal deleted successfully.");
      }
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast.error("Failed to delete goal.");
    }
  };
  
  const handleResetGoal = async (goalId: number) => {
    if (!project?.id) {
      toast.error("Project ID is missing.");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('project_goals')
        .update({ current_count: 0 })
        .eq('id', goalId);
        
      if (error) {
        console.error("Error resetting goal:", error);
        toast.error("Failed to reset goal.");
      } else {
        setGoals((currentGoals) => {
          return currentGoals.map((goal) => {
            if (goal.id === goalId) {
              return { ...goal, current_count: 0 };
            }
            return goal;
          });
        });
        
        toast.success("Goal reset successfully.");
      }
    } catch (error) {
      console.error("Error resetting goal:", error);
      toast.error("Failed to reset goal.");
    }
  };
  
  const handleGoalFormSubmit = async (newGoal: Goal) => {
    if (!project?.id) {
      setGoals((currentGoals) => [...currentGoals, { ...newGoal, id: Math.random() }]);
      setIsGoalFormOpen(false);
      setSelectedGoal(null);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('project_goals')
        .insert([
          {
            ...newGoal,
            project_id: project.id
          }
        ])
        .select()
        .single();
      
      if (error) {
        console.error("Error creating goal:", error);
        toast.error("Failed to create goal.");
      } else {
        setGoals((currentGoals) => [...currentGoals, data]);
        setIsGoalFormOpen(false);
        setSelectedGoal(null);
        
        toast.success("Goal created successfully.");
      }
    } catch (error) {
      console.error("Error creating goal:", error);
      toast.error("Failed to create goal.");
    }
  };
  
  const handleGoalFormUpdate = async (updatedGoal: Goal) => {
    if (!project?.id) {
      toast.error("Project ID is missing.");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('project_goals')
        .update(updatedGoal)
        .eq('id', updatedGoal.id);
      
      if (error) {
        console.error("Error updating goal:", error);
        toast.error("Failed to update goal.");
      } else {
        setGoals((currentGoals) => {
          return currentGoals.map((goal) => {
            if (goal.id === updatedGoal.id) {
              return { ...goal, ...updatedGoal };
            }
            return goal;
          });
        });
        
        setIsGoalFormOpen(false);
        setSelectedGoal(null);
        
        toast.success("Goal updated successfully.");
      }
    } catch (error) {
      console.error("Error updating goal:", error);
      toast.error("Failed to update goal.");
    }
  };
  
  const handleTaskSelection = (taskId: number) => {
    setSelectedTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };
  
  const handleSave = async () => {
    if (!projectName.trim()) {
      toast.error("Project name is required.");
      return;
    }
    
    if (!taskListId) {
      toast.error("Please select a task list.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const projectData = {
        'Project Name': projectName,
        date_started: dateStarted?.toISOString(),
        date_due: dateDue?.toISOString(),
        progress: progress,
        isRecurring: isRecurring,
        recurringTaskCount: recurringTaskCount,
        task_list_id: taskListId,
        id: project?.id,
        selectedTasks: selectedTasks
      };
      
      if (project?.id) {
        const { error } = await supabase
          .from('Projects')
          .update({
            'Project Name': projectName,
            date_started: dateStarted?.toISOString(),
            date_due: dateDue?.toISOString(),
            progress: progress,
            isRecurring: isRecurring,
            recurringTaskCount: recurringTaskCount,
            task_list_id: taskListId
          })
          .eq('id', project.id);
        
        if (error) {
          console.error("Error updating project:", error);
          toast.error("Failed to update project.");
          setIsSaving(false);
          return;
        }
        
        const { error: tasksError } = await supabase
          .from('Tasks')
          .update({ project_id: null })
          .eq('project_id', project.id);
        
        if (tasksError) {
          console.error("Error clearing project tasks:", tasksError);
        }
        
        if (selectedTasks.length > 0) {
          const { error: assignError } = await supabase
            .from('Tasks')
            .update({ project_id: project.id })
            .in('id', selectedTasks);
          
          if (assignError) {
            console.error("Error assigning tasks to project:", assignError);
          }
        }
        
        onUpdateProject({
          ...project,
          ...projectData
        });
        
        toast.success("Project updated successfully.");
      } else {
        const { data: newProject, error } = await supabase
          .from('Projects')
          .insert([{
            'Project Name': projectName,
            date_started: dateStarted?.toISOString(),
            date_due: dateDue?.toISOString(),
            progress: progress,
            isRecurring: isRecurring,
            recurringTaskCount: recurringTaskCount,
            task_list_id: taskListId,
            sort_order: 0
          }])
          .select()
          .single();
        
        if (error) {
          console.error("Error creating project:", error);
          toast.error("Failed to create project.");
          setIsSaving(false);
          return;
        }
        
        if (selectedTasks.length > 0) {
          const { error: assignError } = await supabase
            .from('Tasks')
            .update({ project_id: newProject.id })
            .in('id', selectedTasks);
          
          if (assignError) {
            console.error("Error assigning tasks to project:", assignError);
          }
        }
        
        const goalsToCreate = goals.map(goal => ({
          ...goal,
          project_id: newProject.id,
          id: undefined
        }));
        
        const { error: goalsError } = await supabase
          .from('project_goals')
          .insert(goalsToCreate);
        
        if (goalsError) {
          console.error("Error creating project goals:", goalsError);
        }
        
        onUpdateProject({
          ...newProject,
          goals: goals
        });
        
        toast.success("Project created successfully.");
      }
      
      setEditMode(false);
      onClose();
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error("Failed to save project.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const tasksByList = availableTasks.reduce((acc, task) => {
    const listId = task.task_list_id;
    if (!acc[listId]) {
      acc[listId] = [];
    }
    acc[listId].push(task);
    return acc;
  }, {} as Record<string, any[]>);
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{project ? (editMode ? "Edit Project" : "Project Details") : "Create New Project"}</DialogTitle>
          <DialogDescription>
            {project ? (editMode ? "Make changes to your project" : "View and manage your project") : "Create a new project to organize your tasks"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex border-b mb-6">
          <button
            className={`px-4 py-2 ${activeTab === 'details' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('details')}
          >
            Project Details
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'tasks' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('tasks')}
          >
            Tasks
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'goals' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('goals')}
          >
            Goals
          </button>
        </div>
        
        {activeTab === 'details' && (
          <>
            {editMode ? (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input 
                    id="name" 
                    value={projectName} 
                    className="col-span-3" 
                    onChange={(e) => setProjectName(e.target.value)} 
                    placeholder="Enter project name"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="taskList" className="text-right">
                    Task List
                  </Label>
                  <div className="col-span-3">
                    <Select 
                      value={taskListId?.toString() || ''} 
                      onValueChange={(value) => setTaskListId(parseInt(value))}
                    >
                      <SelectTrigger className="w-full">
                        <div className="flex items-center gap-2">
                          <ListFilter className="h-4 w-4" />
                          <SelectValue placeholder="Select a list" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {taskLists.map((list) => (
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
                  </div>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dateStarted" className="text-right">
                    Date Started
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !dateStarted && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateStarted ? format(dateStarted, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateStarted}
                        onSelect={setDateStarted}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="dateDue" className="text-right">
                    Date Due
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !dateDue && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateDue ? format(dateDue, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateDue}
                        onSelect={setDateDue}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="progress" className="text-right">
                    Status
                  </Label>
                  <Select 
                    value={progress} 
                    onValueChange={(value: 'Not started' | 'In progress' | 'Completed' | 'Backlog') => setProgress(value)}
                  >
                    <SelectTrigger className="col-span-3 w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Not started">Not started</SelectItem>
                      <SelectItem value="In progress">In progress</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="Backlog">Backlog</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="isRecurring" className="text-right">
                    Recurring Tasks
                  </Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Switch
                      id="isRecurring"
                      checked={isRecurring}
                      onCheckedChange={setIsRecurring}
                    />
                    <span className="text-sm">
                      {isRecurring ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {isRecurring && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="recurringTaskCount" className="text-right">
                      Daily Task Count
                    </Label>
                    <Input
                      id="recurringTaskCount"
                      type="number"
                      min="1"
                      max="10"
                      value={recurringTaskCount}
                      onChange={(e) => setRecurringTaskCount(Number(e.target.value))}
                      className="w-20"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 items-start gap-2">
                  <Label htmlFor="name" className="text-left">
                    Name
                  </Label>
                  <div className="text-lg font-semibold">{projectName || "No name provided"}</div>
                </div>
                
                <div className="grid grid-cols-1 items-start gap-2">
                  <Label htmlFor="taskList" className="text-left">
                    Task List
                  </Label>
                  <div className="flex items-center gap-2">
                    {taskLists.find(list => list.id === taskListId) ? (
                      <>
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ 
                            backgroundColor: taskLists.find(list => list.id === taskListId)?.color || 'gray'
                          }} 
                        />
                        <span>{taskLists.find(list => list.id === taskListId)?.name || "Default List"}</span>
                      </>
                    ) : (
                      <span>Default List</span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 items-start gap-2">
                  <Label htmlFor="dateStarted" className="text-left">
                    Date Started
                  </Label>
                  <div>{dateStarted ? format(dateStarted, "PPP") : "Not specified"}</div>
                </div>
                <div className="grid grid-cols-1 items-start gap-2">
                  <Label htmlFor="dateDue" className="text-left">
                    Date Due
                  </Label>
                  <div>{dateDue ? format(dateDue, "PPP") : "Not specified"}</div>
                </div>

                <div className="grid grid-cols-1 items-start gap-2">
                  <Label htmlFor="recurring" className="text-left flex items-center gap-2">
                    <Repeat className="h-4 w-4" />
                    Recurring Tasks
                  </Label>
                  <div className="flex items-center">
                    {isRecurring ? (
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Enabled ({recurringTaskCount} tasks per day)
                      </span>
                    ) : (
                      <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                        Disabled
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        {activeTab === 'tasks' && (
          <div className="py-4">
            <h3 className="text-lg font-medium mb-2">Select Tasks</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Choose which tasks to include in this project
            </p>
            
            <ScrollArea className="h-[300px] rounded-md border p-4">
              {Object.entries(tasksByList).map(([listId, tasks]) => {
                const list = taskLists.find(l => l.id === parseInt(listId));
                return (
                  <div key={listId} className="mb-4">
                    <div className="mb-2 font-medium flex items-center gap-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: list?.color || 'gray' }}
                      />
                      {list?.name || "Unknown List"}
                    </div>
                    <div className="space-y-2 pl-4">
                      {tasks.map(task => (
                        <div key={task.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`task-${task.id}`} 
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={() => handleTaskSelection(task.id)}
                          />
                          <label 
                            htmlFor={`task-${task.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {task["Task Name"]}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {Object.keys(tasksByList).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks available. Create some tasks first!
                </div>
              )}
            </ScrollArea>
            
            <div className="flex justify-between items-center mt-4">
              <p className="text-sm text-muted-foreground">
                {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
        )}
        
        {activeTab === 'goals' && (
          <div className="py-4">
            {isLoadingGoals ? (
              <div className="flex justify-center py-4">
                <div className="animate-pulse text-gray-400">Loading project goals...</div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Project Goals</h3>
                  <Button variant="outline" onClick={() => setIsGoalFormOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Goal
                  </Button>
                </div>
                
                {goals.length > 0 ? (
                  <ProjectGoalsList 
                    goals={goals} 
                    projectId={project?.id}
                    onEdit={handleEditGoal}
                    onDelete={handleDeleteGoal}
                    onReset={handleResetGoal}
                  />
                ) : (
                  <div className="text-center py-8 border rounded-md text-muted-foreground">
                    No goals added yet. Add your first goal!
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          {editMode ? (
            <div className="space-x-2">
              {project ? (
                <Button variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
              ) : (
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
              )}
              <Button type="submit" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : (project ? "Update" : "Create")}
              </Button>
            </div>
          ) : (
            <div className="space-x-2">
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button onClick={() => setEditMode(true)}>Edit</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
      
      <Dialog open={isGoalFormOpen} onOpenChange={() => {
        setIsGoalFormOpen(false);
        setSelectedGoal(null);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{selectedGoal ? "Edit Goal" : "Add Goal"}</DialogTitle>
            <DialogDescription>
              {selectedGoal ? "Make changes to your goal" : "Create a new goal for this project"}
            </DialogDescription>
          </DialogHeader>
          <GoalForm 
            goal={selectedGoal} 
            onSubmit={selectedGoal ? handleGoalFormUpdate : handleGoalFormSubmit} 
            onCancel={() => {
              setIsGoalFormOpen(false);
              setSelectedGoal(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};
