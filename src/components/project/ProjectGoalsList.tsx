
import React from 'react';
import { Trophy, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useRecalculateProjectGoals } from '@/hooks/useRecalculateProjectGoals';

// Update the props to match what's expected in ProjectModal.tsx
export const ProjectGoalsList = ({ 
  goals, 
  projectId, 
  onEdit = undefined,
  onDelete = undefined,
  onReset = undefined
}) => {
  const recalculateGoals = useRecalculateProjectGoals();
  
  if (!goals || goals.length === 0) {
    return null;
  }
  
  const getFormattedGoalType = (goal) => {
    switch (goal.goal_type) {
      case 'daily':
        return "Daily";
      case 'weekly':
        return "Weekly";
      case 'single_date':
        return format(new Date(goal.start_date), 'MMM d');
      case 'date_period':
        return `${format(new Date(goal.start_date), 'MMM d')} - ${goal.end_date ? format(new Date(goal.end_date), 'MMM d') : 'ongoing'}`;
      default:
        return "";
    }
  };
  
  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Project Goals
        </h2>
        <Button 
          size="sm" 
          variant="ghost" 
          onClick={() => recalculateGoals(projectId)}
          className="flex items-center gap-1"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Recalculate</span>
        </Button>
      </div>
      
      {goals.map((goal) => (
        <div key={goal.id} className="border rounded-lg p-3 bg-primary-foreground bg-opacity-10">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-medium">
                {goal.current_count}/{goal.task_count_goal} tasks
              </span>
              <span className="text-sm ml-2">
                ({getFormattedGoalType(goal)})
              </span>
            </div>
            <div className="text-sm">
              {goal.is_enabled ? 
                <span className="text-green-600">Active</span> : 
                <span className="text-gray-500">Disabled</span>
              }
            </div>
          </div>
          
          {goal.reward && (
            <div className="text-sm italic">
              Reward: {goal.reward}
            </div>
          )}
          
          <div className="w-full bg-gray-300 bg-opacity-30 rounded-full h-1.5 mt-1">
            <div 
              className="bg-primary h-1.5 rounded-full" 
              style={{ 
                width: `${Math.min(100, (goal.current_count / goal.task_count_goal) * 100)}%` 
              }}
            ></div>
          </div>
          
          {/* Render edit/delete buttons only if the callback handlers are provided */}
          {(onEdit || onDelete || onReset) && (
            <div className="flex gap-2 mt-2 justify-end">
              {onReset && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onReset(goal.id)}
                >
                  Reset
                </Button>
              )}
              {onEdit && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => onEdit(goal)}
                >
                  Edit
                </Button>
              )}
              {onDelete && (
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => onDelete(goal.id)}
                >
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
