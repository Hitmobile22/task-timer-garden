
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Goal } from '@/types/goals.types';

interface GoalFormProps {
  goal?: Goal | null;
  onSubmit: (goal: any) => void;
  onCancel: () => void;
}

export const GoalForm = ({ 
  goal = null, 
  onSubmit, 
  onCancel 
}: GoalFormProps) => {
  const [goalType, setGoalType] = useState(goal?.goal_type || 'daily');
  const [taskCount, setTaskCount] = useState(goal?.task_count_goal || 5);
  const [startDate, setStartDate] = useState(goal?.start_date ? new Date(goal?.start_date) : new Date());
  const [endDate, setEndDate] = useState(goal?.end_date ? new Date(goal?.end_date) : null);
  const [reward, setReward] = useState(goal?.reward || '');
  const [isEnabled, setIsEnabled] = useState(goal?.is_enabled !== undefined ? goal.is_enabled : true);

  useEffect(() => {
    if (goal) {
      setGoalType(goal.goal_type);
      setTaskCount(goal.task_count_goal);
      setStartDate(goal.start_date ? new Date(goal.start_date) : new Date());
      setEndDate(goal.end_date ? new Date(goal.end_date) : null);
      setReward(goal.reward || '');
      setIsEnabled(goal.is_enabled !== undefined ? goal.is_enabled : true);
    }
  }, [goal]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create a base goal object
    const newGoal: Partial<Goal> = {
      goal_type: goalType,
      task_count_goal: parseInt(taskCount as unknown as string),
      start_date: startDate?.toISOString(),
      end_date: goalType === 'date_period' ? endDate?.toISOString() : null,
      reward: reward,
      is_enabled: isEnabled,
    };
    
    if (goal?.id) {
      // If editing an existing goal, include its id
      newGoal.id = goal.id;

      // Include current count if available
      if (typeof goal.current_count !== 'undefined') {
        newGoal.current_count = goal.current_count;
      }
    }
    
    onSubmit(newGoal);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label htmlFor="goal-type">Goal Type</Label>
        <RadioGroup 
          id="goal-type" 
          value={goalType} 
          onValueChange={setGoalType}
          className="flex flex-col space-y-1"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="daily" id="daily" />
            <Label htmlFor="daily">Daily Goal</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="weekly" id="weekly" />
            <Label htmlFor="weekly">Weekly Goal</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single_date" id="single_date" />
            <Label htmlFor="single_date">Single Date</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="date_period" id="date_period" />
            <Label htmlFor="date_period">Date Period</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="task-count">Task Count Goal</Label>
        <Input 
          id="task-count" 
          type="number" 
          value={taskCount} 
          onChange={(e) => setTaskCount(parseInt(e.target.value))}
          min={1}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label>Start Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
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
              onSelect={setStartDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {goalType === 'date_period' && (
        <div className="space-y-2">
          <Label>End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                disabled={(date) => date < startDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reward">Reward (Optional)</Label>
        <Textarea 
          id="reward" 
          value={reward} 
          onChange={(e) => setReward(e.target.value)} 
          placeholder="Describe the reward for completing this goal"
          className="w-full"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is-enabled"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="is-enabled">Enable Goal</Label>
      </div>

      <div className="flex justify-end space-x-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {goal ? 'Update' : 'Create'} Goal
        </Button>
      </div>
    </form>
  );
};
