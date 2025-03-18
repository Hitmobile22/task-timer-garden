
import React from 'react';
import { Button } from "@/components/ui/button";
import { 
  Gift, 
  Trash2, 
  Calendar, 
  Trophy
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export interface GoalNotificationProps {
  id: number;
  projectName: string;
  goalType: string;
  reward: string | null;
  completedAt: string;
  onRedeem: (id: number) => void;
  onDelete: (id: number) => void;
}

export const GoalNotification = ({
  id,
  projectName,
  goalType,
  reward,
  completedAt,
  onRedeem,
  onDelete
}: GoalNotificationProps) => {
  const formatGoalType = (type: string) => {
    switch (type) {
      case 'daily': return 'Daily';
      case 'weekly': return 'Weekly';
      case 'single_date': return 'Single Day';
      case 'date_period': return 'Date Period';
      default: return type;
    }
  };

  const handleRedeem = () => {
    onRedeem(id);
    toast.success(`Reward redeemed! Enjoy: ${reward || 'your achievement'}`);
  };

  return (
    <div className="bg-card border rounded-lg p-3 mb-2 shadow-sm">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <span className="font-medium">{projectName}</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {formatGoalType(goalType)}
            </span>
          </div>
          
          {reward && (
            <div className="flex items-center gap-1 text-sm">
              <Gift className="h-4 w-4 text-green-500" />
              <span>{reward}</span>
            </div>
          )}
          
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Completed {formatDistanceToNow(new Date(completedAt), { addSuffix: true })}</span>
          </div>
        </div>
        
        <div className="flex space-x-1">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs flex items-center gap-1"
            onClick={handleRedeem}
          >
            <Gift className="h-3 w-3" />
            Redeem
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onDelete(id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
};
