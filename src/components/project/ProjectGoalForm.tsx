
import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoalType, ProjectGoal } from '@/types/task.types';

interface ProjectGoalFormProps {
  projectId?: number;
  existingGoal?: ProjectGoal;
  onSave: (goalData: Partial<ProjectGoal>) => void;
  onCancel: () => void;
}

export const ProjectGoalForm: React.FC<ProjectGoalFormProps> = ({
  projectId,
  existingGoal,
  onSave,
  onCancel
}) => {
  const [goalType, setGoalType] = useState<GoalType>(existingGoal?.goal_type || 'daily');
  const [taskCount, setTaskCount] = useState(existingGoal?.task_count_goal || 1);
  const [startDate, setStartDate] = useState<Date | undefined>(
    existingGoal?.start_date ? new Date(existingGoal.start_date) : new Date()
  );
  const [endDate, setEndDate] = useState<Date | undefined>(
    existingGoal?.end_date ? new Date(existingGoal.end_date) : undefined
  );
  const [reward, setReward] = useState(existingGoal?.reward || '');
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate) {
      return;
    }

    const goalData: Partial<ProjectGoal> = {
      project_id: projectId,
      goal_type: goalType,
      task_count_goal: taskCount,
      start_date: startDate.toISOString(),
      is_enabled: true
    };

    if (goalType === 'date_period' && endDate) {
      goalData.end_date = endDate.toISOString();
    } else {
      goalData.end_date = null;
    }

    if (reward.trim()) {
      goalData.reward = reward.trim();
    } else {
      goalData.reward = null;
    }

    if (existingGoal?.id) {
      goalData.id = existingGoal.id;
    }

    onSave(goalData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="goal-type">Goal Type</Label>
        <Select value={goalType} onValueChange={(value: GoalType) => setGoalType(value)}>
          <SelectTrigger id="goal-type">
            <SelectValue placeholder="Select goal type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="single_date">Single Date</SelectItem>
            <SelectItem value="date_period">Date Period</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="task-count">Task Count Goal</Label>
        <Input
          id="task-count"
          type="number"
          min={1}
          value={taskCount}
          onChange={(e) => setTaskCount(parseInt(e.target.value) || 1)}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="start-date">
          {goalType === 'single_date' ? 'Date' : 'Start Date'}
        </Label>
        <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
          <PopoverTrigger asChild>
            <Button
              id="start-date"
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
              onSelect={(date) => {
                setStartDate(date);
                setStartDateOpen(false);
                if (goalType === 'date_period' && endDate && date && date > endDate) {
                  setEndDate(undefined);
                }
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
      
      {goalType === 'date_period' && (
        <div className="space-y-2">
          <Label htmlFor="end-date">End Date</Label>
          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                id="end-date"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={(date) => {
                  if (date && startDate && date < startDate) {
                    return;
                  }
                  setEndDate(date);
                  setEndDateOpen(false);
                }}
                disabled={(date) => 
                  date < (startDate || new Date())
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="reward">Reward (Optional)</Label>
        <Input
          id="reward"
          placeholder="e.g., 'Movie night' or 'New book'"
          value={reward}
          onChange={(e) => setReward(e.target.value)}
        />
      </div>
      
      <div className="flex justify-end space-x-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {existingGoal ? 'Update' : 'Add'} Goal
        </Button>
      </div>
    </form>
  );
};
