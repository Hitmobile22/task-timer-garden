
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Trophy, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ProjectGoal } from '@/types/task.types';

interface ProjectGoalsListProps {
  goals: ProjectGoal[];
  onEdit: (goal: ProjectGoal) => void;
  onDelete: (goalId: number) => void;
}

export const ProjectGoalsList: React.FC<ProjectGoalsListProps> = ({
  goals,
  onEdit,
  onDelete
}) => {
  const getGoalTypeBadge = (goalType: string) => {
    switch (goalType) {
      case 'daily':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Daily</Badge>;
      case 'weekly':
        return <Badge variant="outline" className="bg-green-100 text-green-800">Weekly</Badge>;
      case 'single_date':
        return <Badge variant="outline" className="bg-purple-100 text-purple-800">Single Date</Badge>;
      case 'date_period':
        return <Badge variant="outline" className="bg-amber-100 text-amber-800">Date Period</Badge>;
      default:
        return null;
    }
  };

  const formatDateRange = (goal: ProjectGoal) => {
    if (goal.goal_type === 'daily') {
      return <div className="flex items-center text-sm"><Clock className="mr-1 h-3 w-3" /> Daily</div>;
    } else if (goal.goal_type === 'weekly') {
      return <div className="flex items-center text-sm"><Calendar className="mr-1 h-3 w-3" /> Weekly</div>;
    } else if (goal.goal_type === 'single_date') {
      return (
        <div className="flex items-center text-sm">
          <Calendar className="mr-1 h-3 w-3" />
          {format(new Date(goal.start_date), 'MMM d, yyyy')}
        </div>
      );
    } else if (goal.goal_type === 'date_period') {
      return (
        <div className="flex items-center text-sm">
          <Calendar className="mr-1 h-3 w-3" />
          {format(new Date(goal.start_date), 'MMM d')} - 
          {goal.end_date ? format(new Date(goal.end_date), ' MMM d, yyyy') : ' ongoing'}
        </div>
      );
    }
    return null;
  };

  if (goals.length === 0) {
    return <p className="text-sm text-muted-foreground">No goals created yet.</p>;
  }

  return (
    <div className="space-y-3">
      {goals.map((goal) => (
        <div 
          key={goal.id} 
          className="border rounded-lg p-3 flex flex-col space-y-2"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                {getGoalTypeBadge(goal.goal_type)}
                <span className="font-medium flex items-center">
                  <Trophy className="h-4 w-4 mr-1 text-amber-500" />
                  {goal.current_count} / {goal.task_count_goal} tasks
                </span>
              </div>
              {formatDateRange(goal)}
              {goal.reward && (
                <div className="text-sm mt-1">
                  <span className="font-medium">Reward:</span> {goal.reward}
                </div>
              )}
            </div>
            <div className="flex space-x-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0" 
                onClick={() => onEdit(goal)}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-destructive hover:text-destructive" 
                onClick={() => onDelete(goal.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-primary h-2.5 rounded-full" 
              style={{ 
                width: `${Math.min(100, (goal.current_count / goal.task_count_goal) * 100)}%` 
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
};
