
import React, { useState, useEffect } from 'react';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash } from "lucide-react";
import { GoalType, ProjectGoal } from '@/types/goal.types';

interface ProjectGoalSettingsProps {
  projectId: number | null;
  goals: ProjectGoal[];
  onChange: (goals: ProjectGoal[]) => void;
}

export function ProjectGoalSettings({ projectId, goals, onChange }: ProjectGoalSettingsProps) {
  const [isEnabled, setIsEnabled] = useState(goals.length > 0);
  const [localGoals, setLocalGoals] = useState<ProjectGoal[]>(goals);

  // Make sure we initialize with at least one goal when enabled
  useEffect(() => {
    if (isEnabled && localGoals.length === 0 && projectId) {
      // Add a default goal
      setLocalGoals([{
        project_id: projectId,
        is_enabled: true,
        goal_type: 'daily',
        start_date: new Date(),
        task_count_goal: 3,
        current_count: 0
      }]);
    }
  }, [isEnabled, localGoals.length, projectId]);

  // Update parent when our local state changes
  useEffect(() => {
    onChange(isEnabled ? localGoals : []);
  }, [isEnabled, localGoals, onChange]);

  const handleToggleEnable = (checked: boolean) => {
    setIsEnabled(checked);
    if (!checked) {
      // If disabling, clear all goals
      onChange([]);
    } else if (projectId && checked && localGoals.length === 0) {
      // If enabling and no goals, add a default one
      const newGoal: ProjectGoal = {
        project_id: projectId,
        is_enabled: true,
        goal_type: 'daily',
        start_date: new Date(),
        task_count_goal: 3,
        current_count: 0
      };
      setLocalGoals([newGoal]);
      onChange([newGoal]);
    } else {
      // If enabling and goals exist, use them
      onChange(localGoals);
    }
  };

  const addGoal = () => {
    if (!projectId) return;
    
    const newGoal: ProjectGoal = {
      project_id: projectId,
      is_enabled: true,
      goal_type: 'daily',
      start_date: new Date(),
      task_count_goal: 3,
      current_count: 0
    };
    
    const updatedGoals = [...localGoals, newGoal];
    setLocalGoals(updatedGoals);
    onChange(updatedGoals);
  };

  const removeGoal = (index: number) => {
    const updatedGoals = [...localGoals];
    updatedGoals.splice(index, 1);
    setLocalGoals(updatedGoals);
    onChange(updatedGoals);
  };

  const updateGoal = (index: number, field: keyof ProjectGoal, value: any) => {
    const updatedGoals = [...localGoals];
    updatedGoals[index] = { ...updatedGoals[index], [field]: value };
    
    // Special handling for goal_type
    if (field === 'goal_type') {
      const goalType = value as GoalType;
      
      // Reset end_date if not date_period
      if (goalType !== 'date_period') {
        updatedGoals[index].end_date = null;
      } else if (!updatedGoals[index].end_date) {
        // Set a default end_date for date_period (14 days from start)
        const startDate = new Date(updatedGoals[index].start_date);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 14);
        updatedGoals[index].end_date = endDate;
      }
    }
    
    setLocalGoals(updatedGoals);
    onChange(updatedGoals);
  };

  if (!isEnabled) {
    return (
      <div className="flex items-center space-x-2">
        <Switch id="enable-goals" checked={isEnabled} onCheckedChange={handleToggleEnable} />
        <Label htmlFor="enable-goals">Enable project goals</Label>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch id="enable-goals" checked={isEnabled} onCheckedChange={handleToggleEnable} />
          <Label htmlFor="enable-goals">Project goals enabled</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addGoal}
          disabled={!projectId}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Goal
        </Button>
      </div>

      {localGoals.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          No goals set. Add a goal to get started.
        </div>
      )}

      {localGoals.map((goal, index) => (
        <div key={index} className="border rounded-lg p-4 space-y-3 relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={() => removeGoal(index)}
          >
            <Trash className="h-4 w-4" />
          </Button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`goal-type-${index}`}>Goal Type</Label>
              <Select
                value={goal.goal_type}
                onValueChange={(value: GoalType) => updateGoal(index, 'goal_type', value)}
              >
                <SelectTrigger id={`goal-type-${index}`}>
                  <SelectValue placeholder="Select goal type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="single_date">Specific Date</SelectItem>
                  <SelectItem value="date_period">Date Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`task-count-${index}`}>Task Count Goal</Label>
              <Input
                id={`task-count-${index}`}
                type="number"
                min={1}
                value={goal.task_count_goal}
                onChange={(e) => updateGoal(index, 'task_count_goal', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                {goal.goal_type === 'date_period' ? 'Start Date' : 
                 goal.goal_type === 'single_date' ? 'Date' : 'Reference Date'}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !goal.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {goal.start_date ? (
                      format(new Date(goal.start_date), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={goal.start_date ? new Date(goal.start_date) : undefined}
                    onSelect={(date) => date && updateGoal(index, 'start_date', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {goal.goal_type === 'date_period' && (
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !goal.end_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {goal.end_date ? (
                        format(new Date(goal.end_date), "PPP")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={goal.end_date ? new Date(goal.end_date) : undefined}
                      onSelect={(date) => date && updateGoal(index, 'end_date', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`reward-${index}`}>Reward (Optional)</Label>
            <Textarea
              id={`reward-${index}`}
              placeholder="What reward do you get when you achieve this goal?"
              value={goal.reward || ''}
              onChange={(e) => updateGoal(index, 'reward', e.target.value)}
              className="h-20 resize-none"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
