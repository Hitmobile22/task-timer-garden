
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

export interface GoalNotification {
  id: number;
  project_goal_id: number;
  project_id: number;
  goal_type: string;
  reward: string | null;
  completed_at: string;
  is_deleted: boolean;
  is_redeemed: boolean;
  project_name: string;
  Projects?: {
    "Project Name": string;
  } | null;
}

export const useGoalNotifications = () => {
  return useQuery({
    queryKey: ['goal-notifications'],
    queryFn: async (): Promise<GoalNotification[]> => {
      const { data: notifications, error } = await supabase
        .from('goal_completion_notifications')
        .select(`
          *,
          Projects:project_id ("Project Name")
        `)
        .eq('is_deleted', false)
        .eq('is_redeemed', false)
        .order('completed_at', { ascending: false });
      
      if (error) throw error;
      
      return notifications.map(notification => ({
        ...notification,
        project_name: notification.Projects ? notification.Projects["Project Name"] : 'Unknown Project'
      }));
    }
  });
};
