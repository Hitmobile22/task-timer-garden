
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
  
  // Improved filtering for active goals to ensure daily goals show properly
  const activeGoals = goals.filter(goal => {
    // For daily goals, show all enabled ones regardless of date
    // Daily goals are reset each day so we should always show them
    if (goal.goal_type === 'daily' && goal.is_enabled) {
      return true;
    }
    
    // For weekly goals, check if we're in the current week
    if (goal.goal_type === 'weekly' && goal.is_enabled) {
      return true;
    }
    
    // For single date goals, check if the date matches
    if (goal.goal_type === 'single_date' && goal.start_date) {
      const goalDate = new Date(goal.start_date);
      const today = new Date();
      return goalDate.toDateString() === today.toDateString() && goal.is_enabled;
    }
    
    // For date period goals, check if we're in the range
    if (goal.goal_type === 'date_period' && goal.is_enabled) {
      const today = new Date();
      let inRange = true;
      
      if (goal.start_date) {
        const startDate = new Date(goal.start_date);
        if (today < startDate) inRange = false;
      }
      
      if (goal.end_date) {
        const endDate = new Date(goal.end_date);
        if (today > endDate) inRange = false;
      }
      
      return inRange;
    }
    
    return false;
  });

  return (
    <div className="w-full space-y-2 mt-2">
      {activeGoals.map((goal) => (
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
