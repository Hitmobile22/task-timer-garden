
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

export const useRecalculateProjectGoals = () => {
  const queryClient = useQueryClient();
  
  const recalculateGoals = useCallback(async (projectId: number) => {
    try {
      // Get all goals for this project
      const { data: goals, error: goalsError } = await supabase
        .from('project_goals')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_enabled', true);
        
      if (goalsError) throw goalsError;
      
      if (!goals || goals.length === 0) {
        toast.info('No goals found for this project');
        return;
      }
      
      let updated = 0;
      
      // Process each goal
      for (const goal of goals) {
        let completedTasksQuery = supabase
          .from('Tasks')
          .select('id')
          .eq('project_id', projectId)
          .eq('Progress', 'Completed');
          
        // Apply date filters based on goal type
        switch (goal.goal_type) {
          case 'daily':
            // For daily goals, use the current date's start and end
            const today = new Date();
            const startOfDay = new Date(today.setHours(0, 0, 0, 0));
            const endOfDay = new Date(today.setHours(23, 59, 59, 999));
            
            completedTasksQuery = completedTasksQuery
              .gte('date_started', startOfDay.toISOString())
              .lte('date_started', endOfDay.toISOString());
            break;
            
          case 'weekly':
            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Go to start of week (Sunday)
            startOfWeek.setHours(0, 0, 0, 0);
            completedTasksQuery = completedTasksQuery
              .gte('date_started', startOfWeek.toISOString())
              .lt('date_started', new Date(startOfWeek.getTime() + 7 * 86400000).toISOString());
            break;
            
          case 'single_date':
            if (goal.start_date) {
              const dateStart = new Date(goal.start_date);
              dateStart.setHours(0, 0, 0, 0);
              completedTasksQuery = completedTasksQuery
                .gte('date_started', dateStart.toISOString())
                .lt('date_started', new Date(dateStart.getTime() + 86400000).toISOString());
            }
            break;
            
          case 'date_period':
            if (goal.start_date) {
              completedTasksQuery = completedTasksQuery
                .gte('date_started', new Date(goal.start_date).toISOString());
                
              if (goal.end_date) {
                const endDate = new Date(goal.end_date);
                endDate.setHours(23, 59, 59, 999);
                completedTasksQuery = completedTasksQuery
                  .lte('date_started', endDate.toISOString());
              }
            }
            break;
        }
        
        // Execute the query
        const { data: completedTasks, error: tasksError } = await completedTasksQuery;
        
        if (tasksError) {
          console.error('Error fetching completed tasks:', tasksError);
          continue;
        }
        
        const taskCount = completedTasks?.length || 0;
        
        // Update the goal count if different
        if (goal.current_count !== taskCount) {
          const { error: updateError } = await supabase
            .from('project_goals')
            .update({ current_count: taskCount })
            .eq('id', goal.id);
            
          if (updateError) {
            console.error('Error updating goal count:', updateError);
          } else {
            console.log(`Updated goal ${goal.id} count from ${goal.current_count} to ${taskCount}`);
            updated++;
          }
        }
      }
      
      // Invalidate queries to refresh UI
      if (updated > 0) {
        queryClient.invalidateQueries({ queryKey: ['project-goals'] });
        queryClient.invalidateQueries({ queryKey: ['goal-notifications'] });
        toast.success(`Updated ${updated} goal(s) with correct task counts`);
      } else {
        toast.info('All goals already have correct task counts');
      }
      
    } catch (error) {
      console.error('Error recalculating goals:', error);
      toast.error('Failed to recalculate goals');
    }
  }, [queryClient]);
  
  return recalculateGoals;
};
