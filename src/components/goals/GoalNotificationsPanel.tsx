import React, { useState, useEffect } from 'react';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { Trophy, ChevronUp, ChevronDown } from 'lucide-react';
import { GoalNotification, GoalNotificationProps } from './GoalNotification';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

interface GoalNotification {
  id: number;
  project_goal_id: number;
  project_id: number;
  goal_type: string;
  reward: string | null;
  completed_at: string;
  is_redeemed: boolean;
  is_deleted: boolean;
  project_name?: string;
}

interface GoalNotificationsPanelProps {
  notifications: GoalNotification[];
  isLoading: boolean;
}

export const GoalNotificationsPanel = ({
  notifications,
  isLoading
}: GoalNotificationsPanelProps) => {
  const [open, setOpen] = useState(true);
  const queryClient = useQueryClient();
  const [processedNotifications, setProcessedNotifications] = useState<Set<number>>(new Set());
  
  useEffect(() => {
    if (notifications && notifications.length > 0) {
      const goalMap = new Map<number, GoalNotification>();
      
      const sortedNotifications = [...notifications].sort(
        (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      );
      
      sortedNotifications.forEach(notification => {
        if (!goalMap.has(notification.project_goal_id)) {
          goalMap.set(notification.project_goal_id, notification);
        }
      });
      
      const duplicates = sortedNotifications
        .filter(n => goalMap.get(n.project_goal_id)?.id !== n.id)
        .map(n => n.id);
      
      if (duplicates.length > 0) {
        console.log(`Found ${duplicates.length} duplicate notifications to clean up`);
        duplicates.forEach(id => {
          setProcessedNotifications(prev => new Set([...prev, id]));
          deleteNotificationMutation.mutate(id);
        });
      }
    }
  }, [notifications]);
  
  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('goal_completion_notifications')
        .update({ is_deleted: true })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal-notifications'] });
    }
  });
  
  const redeemNotificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('goal_completion_notifications')
        .update({ is_redeemed: true, is_deleted: true })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goal-notifications'] });
    }
  });
  
  const handleRedeemNotification = (id: number) => {
    redeemNotificationMutation.mutate(id);
  };
  
  const handleDeleteNotification = (id: number) => {
    deleteNotificationMutation.mutate(id);
  };
  
  const filteredNotifications = notifications?.filter(
    n => !processedNotifications.has(n.id)
  ) || [];
  
  if ((!filteredNotifications || filteredNotifications.length === 0) && !isLoading) {
    return null;
  }

  return (
    <div className="rounded-t-lg bg-background border-x border-t shadow-lg mt-6 fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-3xl z-10">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2 hover:bg-muted/50">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <span className="font-medium">Unlocked Rewards ({filteredNotifications.length})</span>
          </div>
          {open ? (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-2 max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading rewards...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">No rewards to show</div>
          ) : (
            filteredNotifications.map(notification => (
              <GoalNotification 
                key={notification.id}
                id={notification.id}
                projectName={notification.project_name || 'Project'}
                goalType={notification.goal_type}
                reward={notification.reward}
                completedAt={notification.completed_at}
                onRedeem={handleRedeemNotification}
                onDelete={handleDeleteNotification}
              />
            ))
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
