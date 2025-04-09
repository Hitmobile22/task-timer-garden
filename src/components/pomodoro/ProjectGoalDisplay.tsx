
import React from 'react';
import { Trophy } from 'lucide-react';
import { ProjectGoal } from '@/types/task.types';
import { format } from 'date-fns';

interface ProjectGoalDisplayProps {
  goals: ProjectGoal[];
}

export const ProjectGoalDisplay: React.FC<ProjectGoalDisplayProps> = ({ goals }) => {
  if (!goals || goals.length === 0) {
    return null;
  }

  const getFormattedGoalType = (goal: ProjectGoal) => {
    switch (goal.goal_type) {
      case 'daily':
        return "Daily";
      case 'weekly':
        return "Weekly";
      case 'single_date':
        return goal.start_date ? format(new Date(goal.start_date), 'MMM d') : "Single date";
      case 'date_period':
        return `${goal.start_date ? format(new Date(goal.start_date), 'MMM d') : ''} - ${goal.end_date ? format(new Date(goal.end_date), 'MMM d') : 'ongoing'}`;
      default:
        return "";
    }
  };

  return (
    <div className="w-full space-y-2 mt-2">
      {goals.map((goal) => (
        <div key={goal.id} className="text-xs flex flex-col items-center p-1 rounded bg-primary-foreground bg-opacity-10">
          <div className="flex items-center gap-1">
            <Trophy className="h-3 w-3 text-amber-500" />
            <span className="font-medium">
              {goal.current_count || 0}/{goal.task_count_goal || 0} tasks ({getFormattedGoalType(goal)})
            </span>
          </div>
          {goal.reward && (
            <div className="text-xs italic">
              Reward: {goal.reward}
            </div>
          )}
          <div className="w-full bg-gray-300 bg-opacity-30 rounded-full h-1.5 mt-1">
            <div 
              className="bg-primary h-1.5 rounded-full" 
              style={{ 
                width: `${Math.min(100, ((goal.current_count || 0) / (goal.task_count_goal || 1)) * 100)}%` 
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};
