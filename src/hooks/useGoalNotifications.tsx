
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";

export const useGoalNotifications = () => {
  return useQuery({
    queryKey: ['goal-notifications'],
    queryFn: async () => {
      // Get active notifications (not deleted or redeemed)
      const { data: notifications, error } = await supabase
        .from('goal_completion_notifications')
        .select(`
          *,
          Projects:project_id ("Project Name")
        `)
        .eq('is_deleted', false)
        .order('completed_at', { ascending: false });
      
      if (error) throw error;
      
      // Add project name to each notification for easier display
      return notifications.map(notification => ({
        ...notification,
        project_name: notification.Projects ? notification.Projects["Project Name"] : 'Unknown Project'
      }));
    }
  });
};
