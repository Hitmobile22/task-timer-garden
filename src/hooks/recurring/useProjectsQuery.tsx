
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { RecurringProject, RecurringProjectSettings } from '@/types/recurring.types';

export const useProjectsQuery = () => {
  // Query for active recurring projects with their settings
  return useQuery({
    queryKey: ['recurring-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Projects')
        .select(`
          *,
          recurring_settings:recurring_project_settings(*)
        `)
        .eq('isRecurring', true)
        .neq('progress', 'Completed');
      
      if (error) throw error;
      
      console.log(`Found ${data?.length || 0} active recurring projects`);
      if (data && data.length > 0) {
        data.forEach((project: RecurringProject) => {
          console.log(`Recurring Project: ${project.id} (${project['Project Name']}) due: ${project.date_due}`);
          
          // Log project recurring settings if available
          if (project.recurring_settings && project.recurring_settings.length > 0) {
            const settings = project.recurring_settings[0];
            console.log(`Project ${project.id} recurring settings:`, settings);
            console.log(`Project ${project.id} days of week:`, settings.days_of_week || []);
          } else {
            console.log(`Project ${project.id} has no recurring settings configured`);
          }
        });
      }
      
      return data as RecurringProject[] || [];
    },
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    refetchOnWindowFocus: false,
    staleTime: 15 * 60 * 1000, // Data is fresh for 15 minutes
  });
};

export const useDailyGoalsQuery = () => {
  // Query for daily goals to determine if we need to reset them
  return useQuery({
    queryKey: ['daily-project-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_goals')
        .select('*')
        .eq('goal_type', 'daily')
        .eq('is_enabled', true);
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60 * 60 * 1000, // Refetch hourly
    refetchOnWindowFocus: false,
    staleTime: 30 * 60 * 1000, // Stale after 30 minutes
  });
};
