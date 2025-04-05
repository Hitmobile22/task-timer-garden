
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIcon, Plus, Repeat } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ProjectGoalsList } from './ProjectGoalsList';
import { GoalForm } from '../goals/GoalForm';
import { Switch } from "@/components/ui/switch";

interface ProjectModalProps {
  project?: any;
  onClose: () => void;
  onUpdateProject: (project: any) => void;
  projType?: string;
  open: boolean;
}

export const ProjectModal = ({ 
  project = null, 
  onClose, 
  onUpdateProject, 
  projType,
  open = false
}: ProjectModalProps) => {
  const [editMode, setEditMode] = useState(false);
  const [projectName, setProjectName] = useState(project?.['Project Name'] || '');
  const [projectDescription, setProjectDescription] = useState(project?.description || '');
  const [dateStarted, setDateStarted] = useState(project?.date_started ? new Date(project.date_started) : undefined);
  const [dateDue, setDateDue] = useState(project?.date_due ? new Date(project.date_due) : undefined);
  const [progress, setProgress] = useState(project?.progress || 'Not started');
  const [goals, setGoals] = useState(project?.goals || []);
  const [isGoalFormOpen, setIsGoalFormOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecurring, setIsRecurring] = useState(project?.isRecurring || false);
  const [recurringTaskCount, setRecurringTaskCount] = useState(project?.recurringTaskCount || 1);
  
  useEffect(() => {
    setProjectName(project?.['Project Name'] || '');
    setProjectDescription(project?.description || '');
    setDateStarted(project?.date_started ? new Date(project.date_started) : undefined);
    setDateDue(project?.date_due ? new Date(project.date_due) : undefined);
    setProgress(project?.progress || 'Not started');
    setGoals(project?.goals || []);
    setIsRecurring(project?.isRecurring || false);
    setRecurringTaskCount(project?.recurringTaskCount || 1);
  }, [project]);
  
  const handleEditGoal = (goal) => {
    setSelectedGoal(goal);
    setIsGoalFormOpen(true);
  };
  
  const handleDeleteGoal = async (goalId) => {
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
  
  const handleResetGoal = async (goalId) => {
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
  
  const handleGoalFormSubmit = async (newGoal) => {
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
  
  const handleGoalFormUpdate = async (updatedGoal) => {
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
      const { error } = await supabase
        .from('Projects')
        .update({
          'Project Name': projectName,
          description: projectDescription,
          date_started: dateStarted?.toISOString(),
          date_due: dateDue?.toISOString(),
          progress: progress,
          isRecurring: isRecurring,
          recurringTaskCount: recurringTaskCount
        })
        .eq('id', project.id);
      
      if (error) {
        console.error("Error updating project:", error);
        toast("Failed to update project.");
      } else {
        onUpdateProject({
          ...project,
          'Project Name': projectName,
          description: projectDescription,
          date_started: dateStarted?.toISOString(),
          date_due: dateDue?.toISOString(),
          progress: progress,
          goals: goals,
          isRecurring: isRecurring,
          recurringTaskCount: recurringTaskCount
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
                Description
              </Label>
              <Textarea id="description" value={projectDescription} className="col-span-3" onChange={(e) => setProjectDescription(e.target.value)} />
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
                    disabled={(date) =>
                      date > new Date()
                    }
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
                    disabled={(date) =>
                      date < dateStarted || date < new Date()
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Recurring Task Settings */}
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
              <div className="text-lg font-semibold">{projectName}</div>
            </div>
            <div className="grid grid-cols-1 items-start gap-2">
              <Label htmlFor="description" className="text-left">
                Description
              </Label>
              <div>{projectDescription || "No description provided."}</div>
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

            {/* Show recurring task status in view mode */}
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
        
        <ProjectGoalsList 
          goals={goals} 
          projectId={project?.id}
          onEdit={handleEditGoal}
          onDelete={handleDeleteGoal}
          onReset={handleResetGoal}
        />
        
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
      
      <Dialog open={isGoalFormOpen} onOpenChange={() => setIsGoalFormOpen(false)}>
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
