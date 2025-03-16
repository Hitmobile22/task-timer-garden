
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Goal } from "lucide-react";
import { ProjectGoal } from '@/types/goal.types';
import { ProjectGoalSettings } from './ProjectGoalSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProjectGoalModalProps {
  projectId: number | null;
  open: boolean;
  onClose: () => void;
}

export function ProjectGoalModal({ projectId, open, onClose }: ProjectGoalModalProps) {
  const [goals, setGoals] = useState<ProjectGoal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  const { data: projectGoals, isLoading: goalsLoading } = useQuery({
    queryKey: ['project-goals', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_goals')
        .select('*')
        .eq('project_id', projectId);
      
      if (error) throw error;
      return data as ProjectGoal[];
    },
    enabled: !!projectId && open,
  });

  useEffect(() => {
    if (projectGoals) {
      setGoals(projectGoals);
    }
  }, [projectGoals]);

  const saveGoalsMutation = useMutation({
    mutationFn: async (updatedGoals: ProjectGoal[]) => {
      if (!projectId) throw new Error("Project ID is required");
      
      setIsLoading(true);
      
      // First, get current goals for this project
      const { data: existingGoals, error: fetchError } = await supabase
        .from('project_goals')
        .select('id')
        .eq('project_id', projectId);
      
      if (fetchError) throw fetchError;
      
      // Delete all existing goals if we're removing them all
      if (updatedGoals.length === 0 && existingGoals && existingGoals.length > 0) {
        const { error: deleteError } = await supabase
          .from('project_goals')
          .delete()
          .eq('project_id', projectId);
        
        if (deleteError) throw deleteError;
        return { message: "All goals deleted" };
      }
      
      // Process each goal - update existing ones or insert new ones
      for (const goal of updatedGoals) {
        if (goal.id) {
          // Update existing goal
          const { error: updateError } = await supabase
            .from('project_goals')
            .update({
              is_enabled: goal.is_enabled,
              goal_type: goal.goal_type,
              start_date: new Date(goal.start_date).toISOString(),
              end_date: goal.end_date ? new Date(goal.end_date).toISOString() : null,
              task_count_goal: goal.task_count_goal,
              reward: goal.reward || null
            })
            .eq('id', goal.id);
          
          if (updateError) throw updateError;
        } else {
          // Insert new goal
          const { error: insertError } = await supabase
            .from('project_goals')
            .insert({
              project_id: projectId,
              is_enabled: goal.is_enabled,
              goal_type: goal.goal_type,
              start_date: new Date(goal.start_date).toISOString(),
              end_date: goal.end_date ? new Date(goal.end_date).toISOString() : null,
              task_count_goal: goal.task_count_goal,
              reward: goal.reward || null,
              current_count: 0
            });
          
          if (insertError) throw insertError;
        }
      }
      
      // Delete goals that are no longer in the updated list
      if (existingGoals && existingGoals.length > 0) {
        const existingIds = existingGoals.map(g => g.id);
        const updatedIds = updatedGoals.map(g => g.id).filter(id => id !== undefined);
        
        const idsToDelete = existingIds.filter(id => !updatedIds.includes(id));
        
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('project_goals')
            .delete()
            .in('id', idsToDelete);
          
          if (deleteError) throw deleteError;
        }
      }
      
      return { message: "Goals updated successfully" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-goals'] });
      queryClient.invalidateQueries({ queryKey: ['active-goals'] });
      toast.success("Project goals updated successfully");
      onClose();
    },
    onError: (error) => {
      console.error("Error saving goals:", error);
      toast.error("Failed to update project goals");
    },
    onSettled: () => {
      setIsLoading(false);
    }
  });

  const handleSave = () => {
    saveGoalsMutation.mutate(goals);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Goal className="h-5 w-5" />
            Project Goals
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {!projectId ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Please save the project first before setting goals.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Set goals for this project to track your progress. You can set daily, weekly, or date-specific goals.
              </div>
              
              <Separator />
              
              <ProjectGoalSettings 
                projectId={projectId} 
                goals={goals} 
                onChange={setGoals}
              />
            </>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isLoading || !projectId}
          >
            Save Goals
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
