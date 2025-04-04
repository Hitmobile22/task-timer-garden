
import { useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { GenerationLogResult } from '@/types/recurring.types';

export const useGenerationLogCheck = () => {
  // Check if a generation log exists for today
  const checkGenerationLog = useCallback(async (projectId: number): Promise<GenerationLogResult | null> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { data, error } = await supabase
        .from('recurring_task_generation_logs')
        .select('*')
        .eq('project_id', projectId)
        .gte('generation_date', today.toISOString())
        .lt('generation_date', tomorrow.toISOString())
        .maybeSingle();
        
      if (error) {
        console.error(`Error checking generation log for project ${projectId}:`, error);
        return null;
      }
      
      if (data) {
        console.log(`Found generation log for project ${projectId}: ${data.tasks_generated} tasks on ${data.generation_date}`);
      } else {
        console.log(`No generation log found for project ${projectId} today`);
      }
      
      return data;
    } catch (error) {
      console.error('Error in checkGenerationLog:', error);
      return null;
    }
  }, []);

  return checkGenerationLog;
};
