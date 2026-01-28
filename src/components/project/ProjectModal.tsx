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
import { CalendarIcon, Plus, Minus, Repeat, ListFilter, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ProjectGoalsList } from './ProjectGoalsList';
import { GoalForm } from '../goals/GoalForm';
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox"; 
import { ScrollArea } from "@/components/ui/scroll-area";
import { type Goal } from '@/types/goals.types';
import { RichTextEditor } from '../task/editor/RichTextEditor';

// Subtask mode type
type SubtaskMode = 'on_task_creation' | 'progressive' | 'daily' | 'every_x_days' | 'every_x_weeks' | 'days_of_week';

const SUBTASK_MODE_DESCRIPTIONS: Record<SubtaskMode, string> = {
  'on_task_creation': 'Subtasks are added to each new task. Completing them has no effect on the template.',
  'progressive': 'When a subtask is completed, it is permanently removed from future tasks.',
  'daily': 'Completed subtasks are removed from all tasks and respawn at midnight.',
  'every_x_days': 'Completed subtasks respawn after the specified number of days.',
  'every_x_weeks': 'Completed subtasks respawn after the specified number of weeks.',
  'days_of_week': 'Completed subtasks respawn on selected days of the week.',
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface TaskList {
  id: number;
  name: string;
  color?: string;
}

interface ProjectModalProps {
  project?: any;
  onClose: () => void;
  onUpdateProject: (project: any) => void;
  projType?: string;
  open: boolean;
  taskLists: TaskList[];
}

export const ProjectModal = ({ 
  project = null, 
  onClose, 
  onUpdateProject, 
  projType = 'create',
  open = false,
  taskLists = [] as TaskList[] // Explicitly type the default value
}: ProjectModalProps) => {
  const { user } = useAuth();
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
  const [activeTab, setActiveTab] = useState<'details' | 'description' | 'tasks' | 'goals'>('details');
  const [subtaskNames, setSubtaskNames] = useState<string[]>([]);
  const [subtaskMode, setSubtaskMode] = useState<SubtaskMode>('on_task_creation');
  const [respawnIntervalValue, setRespawnIntervalValue] = useState(1);
  const [respawnDaysOfWeek, setRespawnDaysOfWeek] = useState<string[]>([]);
  const [descriptionContent, setDescriptionContent] = useState<any>(null);
  const [showOverdueSuffix, setShowOverdueSuffix] = useState(false);
  
  useEffect(() => {
    // Only set default task list for new projects (when project is null)
    if (taskLists.length > 0 && !taskListId && !project) {
      setTaskListId(taskLists[0].id);
    }
  }, [taskLists, taskListId, project]);

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
      setShowOverdueSuffix(project.show_overdue_suffix || false);
      
      // Load description content from project details
      if (project.details) {
        try {
          const details = typeof project.details === 'string' ? JSON.parse(project.details) : project.details;
          setDescriptionContent(details.description || null);
        } catch (e) {
          console.error("Error parsing project details:", e);
          setDescriptionContent(null);
        }
      } else {
        setDescriptionContent(null);
      }
      
      // Load subtask names and subtask mode from recurring_project_settings
      if (project.id) {
        supabase
          .from('recurring_project_settings')
          .select('subtask_names, subtask_mode, respawn_interval_value, respawn_days_of_week')
          .eq('project_id', project.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.subtask_names) {
              setSubtaskNames(data.subtask_names);
            } else {
              setSubtaskNames([]);
            }
            // Handle migration from old progressive_mode boolean
            setSubtaskMode((data?.subtask_mode as SubtaskMode) || 'on_task_creation');
            setRespawnIntervalValue(data?.respawn_interval_value || 1);
            setRespawnDaysOfWeek(data?.respawn_days_of_week || []);
          });
      }
      
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
      setSubtaskNames([]);
      setSubtaskMode('on_task_creation');
      setRespawnIntervalValue(1);
      setRespawnDaysOfWeek([]);
      setDescriptionContent(null);
      setShowOverdueSuffix(false);
    }
  }, [project, taskLists]);
  
  const handleDescriptionChange = (content: any) => {
    setDescriptionContent(content);
  };
  
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
            project_id: project.id,
            user_id: user?.id
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
      // Build the details object with description
      const detailsObject = {
        description: descriptionContent
      };
      
      const projectData = {
        'Project Name': projectName,
        date_started: dateStarted?.toISOString(),
        date_due: dateDue?.toISOString(),
        progress: progress,
        isRecurring: isRecurring,
        recurringTaskCount: recurringTaskCount,
        task_list_id: taskListId,
        id: project?.id,
        selectedTasks: selectedTasks,
        details: detailsObject
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
            task_list_id: taskListId,
            user_id: user?.id,
            details: detailsObject,
            show_overdue_suffix: showOverdueSuffix
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
        
        // Save subtask names and progressive mode to recurring_project_settings
        if (isRecurring) {
          const filteredSubtaskNames = subtaskNames.filter(name => name.trim() !== '');
          
          // Check if settings exist
          const { data: existingSettings } = await supabase
            .from('recurring_project_settings')
            .select('id')
            .eq('project_id', project.id)
            .maybeSingle();
          
          if (existingSettings) {
            await supabase
              .from('recurring_project_settings')
              .update({ 
                subtask_names: filteredSubtaskNames,
                subtask_mode: subtaskMode,
                respawn_interval_value: respawnIntervalValue,
                respawn_days_of_week: respawnDaysOfWeek
              })
              .eq('project_id', project.id);
          } else {
            await supabase
              .from('recurring_project_settings')
              .insert({
                project_id: project.id,
                user_id: user?.id,
                subtask_names: filteredSubtaskNames,
                subtask_mode: subtaskMode,
                respawn_interval_value: respawnIntervalValue,
                respawn_days_of_week: respawnDaysOfWeek
              });
          }
          
          // Auto-populate subtasks on existing incomplete tasks
          if (filteredSubtaskNames.length > 0) {
            const { data: incompleteTasks } = await supabase
              .from('Tasks')
              .select('id')
              .eq('project_id', project.id)
              .eq('archived', false)
              .in('Progress', ['Not started', 'In progress']);
            
            if (incompleteTasks && incompleteTasks.length > 0) {
              for (const task of incompleteTasks) {
                const { data: existingSubtasks } = await supabase
                  .from('subtasks')
                  .select('*')
                  .eq('Parent Task ID', task.id);
                
                const existingNames = existingSubtasks?.map(s => s['Task Name']) || [];
                
                const newSubtasks = filteredSubtaskNames
                  .filter(name => !existingNames.includes(name))
                  .map((name, index) => ({
                    'Task Name': name,
                    'Parent Task ID': task.id,
                    'Progress': 'Not started' as 'Not started' | 'In progress' | 'Completed' | 'Backlog',
                    'user_id': user?.id!,
                    'sort_order': existingNames.length + index
                  }));
                
                if (newSubtasks.length > 0) {
                  await supabase.from('subtasks').insert(newSubtasks);
                }
              }
            }
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
            sort_order: 0,
            user_id: user?.id,
            details: { description: descriptionContent },
            show_overdue_suffix: showOverdueSuffix
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
          user_id: user?.id,
          id: undefined
        }));
        
        const { error: goalsError } = await supabase
          .from('project_goals')
          .insert(goalsToCreate);
        
        if (goalsError) {
          console.error("Error creating project goals:", goalsError);
        }
        
        // Save subtask names and subtask mode to recurring_project_settings for new project
        if (isRecurring) {
          const filteredSubtaskNames = subtaskNames.filter(name => name.trim() !== '');
          
          await supabase
            .from('recurring_project_settings')
            .insert({
              project_id: newProject.id,
              user_id: user?.id,
              subtask_names: filteredSubtaskNames,
              subtask_mode: subtaskMode,
              respawn_interval_value: respawnIntervalValue,
              respawn_days_of_week: respawnDaysOfWeek
            });
          
          // Auto-populate subtasks on existing incomplete tasks (for new projects with selected tasks)
          if (filteredSubtaskNames.length > 0 && selectedTasks.length > 0) {
            const { data: incompleteTasks } = await supabase
              .from('Tasks')
              .select('id, Progress')
              .in('id', selectedTasks)
              .eq('archived', false)
              .in('Progress', ['Not started', 'In progress']);
            
            if (incompleteTasks && incompleteTasks.length > 0) {
              for (const task of incompleteTasks) {
                const { data: existingSubtasks } = await supabase
                  .from('subtasks')
                  .select('*')
                  .eq('Parent Task ID', task.id);
                
                const existingNames = existingSubtasks?.map(s => s['Task Name']) || [];
                
                const newSubtasks = filteredSubtaskNames
                  .filter(name => !existingNames.includes(name))
                  .map((name, index) => ({
                    'Task Name': name,
                    'Parent Task ID': task.id,
                    'Progress': 'Not started' as 'Not started' | 'In progress' | 'Completed' | 'Backlog',
                    'user_id': user?.id!,
                    'sort_order': existingNames.length + index
                  }));
                
                if (newSubtasks.length > 0) {
                  await supabase.from('subtasks').insert(newSubtasks);
                }
              }
            }
          }
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
  
  const tasksByList = availableTasks.reduce<Record<string, any[]>>((acc, task) => {
    const listId = task.task_list_id;
    if (!acc[listId]) {
      acc[listId] = [];
    }
    acc[listId].push(task);
    return acc;
  }, {});
  
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
            className={`px-4 py-2 ${activeTab === 'description' ? 'border-b-2 border-primary font-medium text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('description')}
          >
            Description
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
                  <Label htmlFor="showOverdueSuffix" className="text-right">
                    Overdue Label
                  </Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Switch
                      id="showOverdueSuffix"
                      checked={showOverdueSuffix}
                      onCheckedChange={setShowOverdueSuffix}
                    />
                    <span className="text-sm text-muted-foreground">
                      {showOverdueSuffix ? 'Add "(overdue)" to name when past due' : 'No automatic overdue label'}
                    </span>
                  </div>
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
                  <>
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
                    
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label className="text-right pt-2">Subtasks</Label>
                      <div className="col-span-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSubtaskNames([...subtaskNames, ''])}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Subtask
                          </Button>
                        </div>
                        
                        {subtaskNames.length > 0 && (
                          <div className="border-l-2 border-primary/20 pl-3 space-y-2">
                            {subtaskNames.map((name, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Input
                                  placeholder={`Subtask ${index + 1}`}
                                  value={name}
                                  onChange={(e) => {
                                    const newNames = [...subtaskNames];
                                    newNames[index] = e.target.value;
                                    setSubtaskNames(newNames);
                                  }}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSubtaskNames(subtaskNames.filter((_, i) => i !== index));
                                  }}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <p className="text-xs text-muted-foreground">
                              These subtasks will be added to each recurring task created
                            </p>
                            
                            <div className="space-y-3 pt-2 border-t border-primary/10">
                              <div className="flex flex-col gap-2">
                                <Label htmlFor="subtaskMode" className="text-sm font-normal">
                                  Subtask Mode
                                </Label>
                                <Select value={subtaskMode} onValueChange={(value: SubtaskMode) => setSubtaskMode(value)}>
                                  <SelectTrigger className="w-full">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="on_task_creation">On Task Creation</SelectItem>
                                    <SelectItem value="progressive">Progressive Mode</SelectItem>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="every_x_days">Every X Days</SelectItem>
                                    <SelectItem value="every_x_weeks">Every X Weeks</SelectItem>
                                    <SelectItem value="days_of_week">Days of Week</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              {/* Show interval input for every_x_days or every_x_weeks */}
                              {(subtaskMode === 'every_x_days' || subtaskMode === 'every_x_weeks') && (
                                <div className="flex items-center gap-2">
                                  <Label className="text-sm">Every</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={respawnIntervalValue}
                                    onChange={(e) => setRespawnIntervalValue(Math.max(1, Number(e.target.value)))}
                                    className="w-20"
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    {subtaskMode === 'every_x_days' ? 'day(s)' : 'week(s)'}
                                  </span>
                                </div>
                              )}
                              
                              {/* Show day checkboxes for days_of_week mode */}
                              {subtaskMode === 'days_of_week' && (
                                <div className="space-y-2">
                                  <Label className="text-sm">Respawn on:</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {DAYS_OF_WEEK.map((day) => (
                                      <div key={day} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={`respawn-${day}`}
                                          checked={respawnDaysOfWeek.includes(day)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setRespawnDaysOfWeek([...respawnDaysOfWeek, day]);
                                            } else {
                                              setRespawnDaysOfWeek(respawnDaysOfWeek.filter(d => d !== day));
                                            }
                                          }}
                                        />
                                        <label
                                          htmlFor={`respawn-${day}`}
                                          className="text-xs font-medium leading-none cursor-pointer"
                                        >
                                          {day.slice(0, 3)}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <p className="text-xs text-muted-foreground">
                                {SUBTASK_MODE_DESCRIPTIONS[subtaskMode]}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
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
        
        {activeTab === 'description' && (
          <div className="py-4">
            <h3 className="text-lg font-medium mb-2">Project Description</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add detailed notes and description for this project
            </p>
            
            <div className="border rounded-md">
              <RichTextEditor
                initialContent={descriptionContent}
                onChange={handleDescriptionChange}
                editable={editMode}
              />
            </div>
          </div>
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
