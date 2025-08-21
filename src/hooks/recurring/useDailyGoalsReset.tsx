
import { useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { 
  getLastDailyGoalResetDay, 
  setLastDailyGoalResetDay,
  getHasShownDailyResetToast,
  setHasShownDailyResetToast
} from '@/utils/recurringUtils';

export const useDailyGoalsReset = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Function to check if daily goals need to be reset
  const checkAndResetDailyGoals = useCallback(async () => {
    if (!user) {
      console.log('User not authenticated, skipping daily goals reset');
      return false;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastReset = getLastDailyGoalResetDay();
    
    // Check if it was reset today by comparing date strings rather than just objects
    if (lastReset.toDateString() === today.toDateString()) {
      console.log('Daily goals already reset today, skipping');
      return false;
    }
    
    try {
      console.log(`Last reset was on ${lastReset.toDateString()}, today is ${today.toDateString()}, checking if daily goals need to be reset`);
      
      // Call the edge function to reset daily goals
      const { data, error } = await supabase.functions.invoke('check-recurring-projects', {
        body: {
          resetDailyGoals: true,
          forceCheck: false,
          projects: [] // Empty array as we're just resetting goals
        }
      });
      
      if (error) {
        console.error('Error resetting daily goals:', error);
        return false;
      }
      
      if (data && data.success) {
        console.log(`Reset ${data.goalsReset || 0} daily goals`);
        
        // Store the reset date more persistently
        setLastDailyGoalResetDay(today);
        localStorage.setItem('last_daily_goals_reset', today.toISOString());
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['daily-project-goals'] });
        queryClient.invalidateQueries({ queryKey: ['project-goals'] });
        
        // Only show toast notification once per day
        if (data.goalsReset > 0 && !getHasShownDailyResetToast()) {
          toast.info(`Reset ${data.goalsReset} daily goals for a new day`);
          setHasShownDailyResetToast(true);
          localStorage.setItem('has_shown_daily_reset_toast', 'true');
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in checkAndResetDailyGoals:', error);
      if (error?.message?.includes('Authentication') || error?.message?.includes('401')) {
        console.error('Authentication required for daily goals reset');
      }
      return false;
    }
  }, [queryClient, user]);

  return checkAndResetDailyGoals;
};
