
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

/**
 * Hook to ensure that project goals have the correct initial count of completed tasks
 * when the goal is created or when the date range changes.
 */
export const useProjectGoalInitialCount = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Function to update initial goal counts
    const updateInitialGoalCounts = async () => {
      try {
        // Get all active project goals
        const { data: goals, error: goalsError } = await supabase
          .from('project_goals')
          .select('*')
          .eq('is_enabled', true);
          
        if (goalsError) throw goalsError;
        
        if (!goals || goals.length === 0) return;
        
        console.log(`Checking initial counts for ${goals.length} project goals`);
        
        // Process each goal
        for (const goal of goals) {
          // For date_period goals, count existing completed tasks in the date range
          if (goal.goal_type === 'date_period' && goal.current_count === 0) {
            const startDate = goal.start_date ? new Date(goal.start_date) : null;
            const endDate = goal.end_date ? new Date(goal.end_date) : null;
            
            if (!startDate) continue;
            
            // Query to get tasks that were completed within the period
            const { data: completedTasks, error: tasksError } = await supabase
              .from('Tasks')
              .select('id')
              .eq('project_id', goal.project_id)
              .eq('Progress', 'Completed')
              .gte('date_started', startDate.toISOString())
              .lte('date_started', endDate ? endDate.toISOString() : new Date().toISOString());
              
            if (tasksError) {
              console.error('Error fetching completed tasks:', tasksError);
              continue;
            }
            
            if (completedTasks && completedTasks.length > 0) {
              console.log(`Goal ${goal.id} (${goal.goal_type}) for project ${goal.project_id}: Found ${completedTasks.length} existing completed tasks`);
              
              // Update the goal count
              const { error: updateError } = await supabase
                .from('project_goals')
                .update({ current_count: completedTasks.length })
                .eq('id', goal.id);
                
              if (updateError) {
                console.error('Error updating goal count:', updateError);
              } else {
                console.log(`Updated goal ${goal.id} count to ${completedTasks.length}`);
                // Invalidate queries to refresh UI
                queryClient.invalidateQueries({ queryKey: ['project-goals'] });
                queryClient.invalidateQueries({ queryKey: ['goal-notifications'] });
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in updateInitialGoalCounts:', error);
      }
    };

    // Run once when the component mounts
    updateInitialGoalCounts();
    
    // Set up interval to check periodically (every 5 minutes)
    const interval = setInterval(updateInitialGoalCounts, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [queryClient]);
  
  return null;
};
