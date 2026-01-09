
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { daysBetween } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export interface ProjectNotification {
  id: number;
  project_id: number;
  project_name: string;
  due_date: string;
  days_remaining: number;
  created_at: string;
  is_read: boolean;
  user_id: string;
}

export function useProjectNotifications() {
  const queryClient = useQueryClient();
  const [isCheckingProjects, setIsCheckingProjects] = useState(false);
  const { user } = useAuth();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['project-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data as ProjectNotification[];
    }
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const { error } = await supabase
        .from('project_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notifications'] });
    }
  });

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('project_notifications')
        .update({ is_read: true })
        .eq('is_read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notifications'] });
      toast.success('All notifications cleared');
    }
  });

  // Check for projects due soon and create notifications
  const checkProjectsDueSoon = async () => {
    if (isCheckingProjects || !user) return;
    
    try {
      setIsCheckingProjects(true);
      
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
              is_read: false,
              user_id: user.id
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
    } finally {
      setIsCheckingProjects(false);
    }
  };

  useEffect(() => {
    // Check for projects due soon on initial load (only when user is available)
    if (user) {
      checkProjectsDueSoon();
    }
    
    // Set up interval to check for projects due soon every hour
    const intervalId = setInterval(checkProjectsDueSoon, 60 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, [user]);

  return {
    notifications,
    isLoading,
    markAsRead: (id: number) => markAsReadMutation.mutate(id),
    markAllAsRead: () => markAllAsReadMutation.mutate(),
    notificationCount: notifications.length
  };
}
