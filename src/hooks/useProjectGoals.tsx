
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProjectGoal } from '@/types/goal.types';

export function useProjectGoals(projectId: number | null | undefined) {
  return useQuery({
    queryKey: ['project-goals', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      
      const { data, error } = await supabase
        .from('project_goals')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_enabled', true);
      
      if (error) throw error;
      return data as ProjectGoal[];
    },
    enabled: !!projectId,
  });
}

export function useActiveGoals() {
  return useQuery({
    queryKey: ['active-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_goals')
        .select(`
          *,
          Projects:project_id ("Project Name")
        `)
        .eq('is_enabled', true);
      
      if (error) throw error;
      
      return data.map(goal => ({
        ...goal,
        projectName: goal.Projects ? goal.Projects["Project Name"] : 'Unknown Project'
      }));
    },
  });
}
