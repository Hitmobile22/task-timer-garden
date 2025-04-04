
import { useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { lastDailyGoalResetDay } from '@/utils/recurringUtils';

export const useDailyGoalsReset = () => {
  const queryClient = useQueryClient();

  // Function to check if daily goals need to be reset
  const checkAndResetDailyGoals = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Only reset once per day
    if (lastDailyGoalResetDay.toDateString() === today.toDateString()) {
      console.log('Daily goals already reset today, skipping');
      return false;
    }
    
    try {
      console.log('Checking if daily goals need to be reset');
      
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
        lastDailyGoalResetDay = today;
        
        // Invalidate relevant queries
        queryClient.invalidateQueries({ queryKey: ['daily-project-goals'] });
        queryClient.invalidateQueries({ queryKey: ['project-goals'] });
        
        if (data.goalsReset > 0) {
          toast.info(`Reset ${data.goalsReset} daily goals for a new day`);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error in checkAndResetDailyGoals:', error);
      return false;
    }
  }, [queryClient]);

  return checkAndResetDailyGoals;
};
