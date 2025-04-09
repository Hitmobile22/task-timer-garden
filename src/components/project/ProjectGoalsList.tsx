
import React, { useEffect } from 'react';
import { Trophy, RefreshCw } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useRecalculateProjectGoals } from '@/hooks/useRecalculateProjectGoals';
import { type Goal } from '@/types/goals.types';

interface ProjectGoalsListProps {
  goals: Goal[];
  projectId?: number; 
  onEdit?: (goal: Goal) => void;
  onDelete?: (goalId: number) => void;
  onReset?: (goalId: number) => void;
}

export const ProjectGoalsList: React.FC<ProjectGoalsListProps> = ({ 
  goals, 
  projectId, 
  onEdit,
  onDelete,
  onReset
}) => {
  const recalculateGoals = useRecalculateProjectGoals();
  
  // Add an effect to automatically recalculate goals when component mounts
  useEffect(() => {
    if (projectId) {
      console.log("ProjectGoalsList: Auto-recalculating goals for project:", projectId);
      recalculateGoals(projectId);
    }
  }, [projectId, recalculateGoals]);
  
  if (!goals || goals.length === 0) {
    return (
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Project Goals
          </h2>
        </div>
        <div className="text-gray-500 italic text-center py-3">
          No goals set for this project yet. Add goals to track your progress!
        </div>
      </div>
    );
  }
  
  const getFormattedGoalType = (goal: Goal) => {
    switch (goal.goal_type) {
      case 'daily':
        return goal.start_date ? format(new Date(goal.start_date), 'MMM d') : "Daily";
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
  
  // Filter to focus on active goals first
  const dailyGoals = goals.filter(g => g.goal_type === 'daily');
  const otherGoals = goals.filter(g => g.goal_type !== 'daily');
  
  const sortedGoals = [...dailyGoals, ...otherGoals];

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Project Goals ({goals.length})
        </h2>
        {projectId && (
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => recalculateGoals(projectId)}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Recalculate</span>
          </Button>
        )}
      </div>
      
      {sortedGoals.map((goal) => (
        <div key={goal.id} className="border rounded-lg p-3 bg-primary-foreground bg-opacity-10">
          <div className="flex justify-between items-center mb-2">
            <div>
              <span className="font-medium">
                {goal.current_count || 0}/{goal.task_count_goal || 0} tasks
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
                width: `${Math.min(100, ((goal.current_count || 0) / (goal.task_count_goal || 1)) * 100)}%` 
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
                  onClick={() => onReset(goal.id || 0)}
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
                  onClick={() => onDelete(goal.id || 0)}
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
