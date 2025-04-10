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
import { CalendarIcon, Plus, Repeat, ListFilter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProjectGoalsList } from './ProjectGoalsList';
import { GoalForm } from '../goals/GoalForm';
import { Switch } from "@/components/ui/switch";
import { type Goal } from '@/types/goals.types';

interface ProjectModalProps {
  project?: any;
  onClose: () => void;
  onUpdateProject: (project: any) => void;
  projType?: string;
  open: boolean;
  taskLists?: any[]; // Added task lists prop
}

export const ProjectModal = ({ 
  project = null, 
  onClose, 
  onUpdateProject, 
  projType,
  open = false,
  taskLists = [] // Default to empty array
}: ProjectModalProps) => {
  const [editMode, setEditMode] = useState(false);
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
  
  useEffect(() => {
    if (project) {
      console.log("Project data loaded:", project);
      
      setProjectName(project['Project Name'] || project.name || '');
      setProjectNotes(project.notes || '');
      setProgress((project.progress || project.status || 'Not started') as 'Not started' | 'In progress' | 'Completed' | 'Backlog');
      setIsRecurring(project.isRecurring || false);
      setRecurringTaskCount(project.recurringTaskCount || 1);
      setTaskListId(project.task_list_id || 1);
      
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
      
      loadProjectGoals(project.id);
    }
  }, [project]);
  
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
        toast("Failed to load project goals");
      } else {
        console.log("Loaded project goals:", data);
        setGoals(data || []);
      }
    } catch (error) {
      console.error("Error loading goals:", error);
      toast("Failed to load project goals");
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
      toast("Project ID is missing.");
      return;
    }
    
    try {
      const { error } = await supabase.from('project_goals').delete().eq('id', goalId);
      
      if (error) {
        console.error("Error deleting goal:", error);
        toast("Failed to delete goal.");
      } else {
        setGoals((currentGoals) => currentGoals.filter((goal) => goal.id !== goalId));
        
        toast("Goal deleted successfully.");
      }
    } catch (error) {
      console.error("Error deleting goal:", error);
      toast("Failed to delete goal.");
    }
  };
  
  const handleResetGoal = async (goalId: number) => {
    if (!project?.id) {
      toast("Project ID is missing.");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('project_goals')
        .update({ current_count: 0 })
        .eq('id', goalId);
        
      if (error) {
        console.error("Error resetting goal:", error);
        toast("Failed to reset goal.");
      } else {
        setGoals((currentGoals) => {
          return currentGoals.map((goal) => {
            if (goal.id === goalId) {
              return { ...goal, current_count: 0 };
            }
            return goal;
          });
        });
        
        toast("Goal reset successfully.");
      }
    } catch (error) {
      console.error("Error resetting goal:", error);
      toast("Failed to reset goal.");
    }
  };
  
  const handleGoalFormSubmit = async (newGoal: Goal) => {
    if (!project?.id) {
      toast("Project ID is missing.");
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
        toast("Failed to create goal.");
      } else {
        setGoals((currentGoals) => [...currentGoals, data]);
        setIsGoalFormOpen(false);
        setSelectedGoal(null);
        
        toast("Goal created successfully.");
      }
    } catch (error) {
      console.error("Error creating goal:", error);
      toast("Failed to create goal.");
    }
  };
  
  const handleGoalFormUpdate = async (updatedGoal: Goal) => {
    if (!project?.id) {
      toast("Project ID is missing.");
      return;
    }
    
    try {
      const { error } = await supabase
        .from('project_goals')
        .update(updatedGoal)
        .eq('id', updatedGoal.id);
      
      if (error) {
        console.error("Error updating goal:", error);
        toast("Failed to update goal.");
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
        
        toast("Goal updated successfully.");
      }
    } catch (error) {
      console.error("Error updating goal:", error);
      toast("Failed to update goal.");
    }
  };
  
  const handleSave = async () => {
    if (!project) {
      toast("Project data is missing.");
      return;
    }
    
    setIsSaving(true);
    
    try {
      console.log("Saving project with data:", {
        'Project Name': projectName,
        date_started: dateStarted?.toISOString(),
        date_due: dateDue?.toISOString(),
        progress,
        isRecurring,
        recurringTaskCount,
        task_list_id: taskListId
      });
      
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
        toast("Failed to update project.");
      } else {
        onUpdateProject({
          ...project,
          'Project Name': projectName,
          name: projectName,
          notes: projectNotes,
          date_started: dateStarted?.toISOString(),
          date_due: dateDue?.toISOString(),
          progress: progress,
          status: progress,
          goals: goals,
          isRecurring: isRecurring,
          recurringTaskCount: recurringTaskCount,
          task_list_id: taskListId
        });
        
        toast("Project updated successfully.");
        setEditMode(false);
      }
    } catch (error) {
      console.error("Error updating project:", error);
      toast("Failed to update project.");
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editMode ? "Edit Project" : "Project Details"}</DialogTitle>
          <DialogDescription>
            {editMode ? "Make changes to your project" : "View and manage your project"}
          </DialogDescription>
        </DialogHeader>
        
        {editMode ? (
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" value={projectName} className="col-span-3" onChange={(e) => setProjectName(e.target.value)} />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Notes
              </Label>
              <Textarea id="description" value={projectNotes} className="col-span-3" onChange={(e) => setProjectNotes(e.target.value)} />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="taskList" className="text-right">
                Task List
              </Label>
              <div className="col-span-3">
                <Select 
                  value={taskListId?.toString() || '1'} 
                  onValueChange={(value) => setTaskListId(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <div className="flex items-center gap-2">
                      <ListFilter className="h-4 w-4" />
                      <SelectValue placeholder="Select a list" />
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
              <Label htmlFor="description" className="text-left">
                Notes
              </Label>
              <div>{projectNotes || "No notes provided."}</div>
            </div>
            
            <div className="grid grid-cols-1 items-start gap-2">
              <Label htmlFor="taskList" className="text-left">
                Task List
              </Label>
              <div className="flex items-center gap-2">
                {taskLists?.find(list => list.id === taskListId) ? (
                  <>
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ 
                        backgroundColor: taskLists?.find(list => list.id === taskListId)?.color || 'gray'
                      }} 
                    />
                    <span>{taskLists?.find(list => list.id === taskListId)?.name || "Default List"}</span>
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
        
        {isLoadingGoals ? (
          <div className="flex justify-center py-4">
            <div className="animate-pulse text-gray-400">Loading project goals...</div>
          </div>
        ) : (
          <ProjectGoalsList 
            goals={goals} 
            projectId={project?.id}
            onEdit={handleEditGoal}
            onDelete={handleDeleteGoal}
            onReset={handleResetGoal}
          />
        )}
        
        <DialogFooter>
          {editMode ? (
            <div className="space-x-2">
              <Button variant="ghost" onClick={() => setEditMode(false)}>Cancel</Button>
              <Button type="submit" onClick={handleSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          ) : (
            <div className="space-x-2">
              <Button variant="ghost" onClick={onClose}>Close</Button>
              <Button onClick={() => setEditMode(true)}>Edit</Button>
            </div>
          )}
          <Button variant="outline" onClick={() => setIsGoalFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Goal
          </Button>
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
