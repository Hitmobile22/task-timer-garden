
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { daysBetween } from '@/lib/utils';

export function useCheckProjectDueDates() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkProjects = async () => {
      try {
        // Get all projects with due dates
        const { data: projects, error } = await supabase
          .from('Projects')
          .select('id, "Project Name", date_due')
          .not('date_due', 'is', null)
          .eq('archived', false);
        
        if (error) throw error;
        
        if (!projects || projects.length === 0) return;
        
        const today = new Date();
        const notificationsToCreate = [];
        
        // Check each project
        for (const project of projects) {
          if (!project.date_due) continue;
          
          const dueDate = new Date(project.date_due);
          const daysRemaining = daysBetween(today, dueDate);
          
          // Create notifications for projects due in 5 days or less
          if (daysRemaining <= 5 && dueDate > today) {
            // Check if notification already exists
            const { data: existingNotifications } = await supabase
              .from('project_notifications')
              .select('id')
              .eq('project_id', project.id)
              .eq('days_remaining', daysRemaining)
              .eq('is_read', false);
            
            if (!existingNotifications || existingNotifications.length === 0) {
              notificationsToCreate.push({
                project_id: project.id,
                project_name: project["Project Name"],
                due_date: project.date_due,
                days_remaining: daysRemaining,
                is_read: false
              });
            }
          }
        }
        
        // Create new notifications
        if (notificationsToCreate.length > 0) {
          const { error: insertError } = await supabase
            .from('project_notifications')
            .insert(notificationsToCreate);
          
          if (insertError) throw insertError;
          
          queryClient.invalidateQueries({ queryKey: ['project-notifications'] });
        }
      } catch (error) {
        console.error('Error checking projects due soon:', error);
      }
    };

    // Check on initial load
    checkProjects();
    
    // Set up interval to check every 2 hours
    const intervalId = setInterval(checkProjects, 2 * 60 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);
}
