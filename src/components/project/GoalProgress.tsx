
import React from 'react';
import { ProjectGoal } from '@/types/goal.types';
import { Badge } from "@/components/ui/badge";
import { Trophy } from 'lucide-react';

interface GoalProgressProps {
  goals: ProjectGoal[];
}

export function GoalProgress({ goals }: GoalProgressProps) {
  if (!goals || goals.length === 0) return null;

  // Only show enabled goals
  const activeGoals = goals.filter(goal => goal.is_enabled);
  if (activeGoals.length === 0) return null;
  
  // Get the first goal with a reward (if any)
  const goalWithReward = activeGoals.find(goal => goal.reward);
  
  return (
    <div className="text-center my-2 flex flex-col items-center gap-1">
      {activeGoals.map((goal, index) => (
        <div key={index} className="text-sm flex items-center gap-1">
          <Trophy className="h-3 w-3 text-amber-500" />
          <span>
            {goal.current_count}/{goal.task_count_goal} tasks
          </span>
          {goal.reward && (
            <Badge variant="outline" className="text-xs">
              {goal.reward}
            </Badge>
          )}
        </div>
      ))}
    </div>
  );
}
