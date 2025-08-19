
import { TaskScheduler } from '@/components/TaskScheduler';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { GoalNotificationsPanel } from '@/components/goals/GoalNotificationsPanel';
import { useGoalNotifications } from '@/hooks/useGoalNotifications';
import { useEffect, useState, useRef } from 'react';
import { useUnifiedRecurringTasksCheck } from '@/hooks/useUnifiedRecurringTasksCheck';
import { useRecurringProjectsCheck } from '@/hooks/useRecurringProjectsCheck';
import { resetToastStateAtMidnight } from '@/utils/recurringUtils';

const Index = () => {
  const { user } = useAuth();
  const { resetDailyGoals } = useRecurringProjectsCheck();
  const [didInitialReset, setDidInitialReset] = useState(false);
  const initialResetRef = useRef(false);
  
  const queryClient = useQueryClient();
  const { data: goalNotifications = [], isLoading: isLoadingNotifications } = useGoalNotifications();
  const recurringTasksChecker = useUnifiedRecurringTasksCheck();
  
  // Check for day change to reset daily goals on page load - just once
  useEffect(() => {
    if (!initialResetRef.current) {
      initialResetRef.current = true;
      
      // Reset daily goals if needed (only on first load)
      resetDailyGoals().then(wasReset => {
        setDidInitialReset(true);
        
        // Reset toast state for a new day
        resetToastStateAtMidnight();
        
        // Check for recurring tasks on page load (without forcing)
        if (!wasReset) {
          recurringTasksChecker.checkRecurringTasks(false);
        }
      });
    }
  }, [resetDailyGoals, recurringTasksChecker]);
  
  const handleShuffleTasks = async () => {
    try {
      const { data: activeTasks, error } = await supabase
        .from('Tasks')
        .select('*')
        .eq('user_id', user?.id)
        .neq('Progress', 'Completed')
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      if (!activeTasks || activeTasks.length === 0) {
        toast.error("No tasks available to shuffle");
        return;
      }
      
      const now = new Date();
      const today = new Date(now);
      today.setUTCHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const tomorrow3AM = new Date(tomorrow);
      tomorrow3AM.setHours(3, 0, 0, 0);
      
      let todayTasks;
      // Convert EST evening mode (9 PM - 3 AM) to UTC for proper comparison
      // 9 PM EST = 2 AM UTC next day, 3 AM EST = 8 AM UTC
      const nowUTC = new Date(now.toISOString());
      const isEveningMode = nowUTC.getUTCHours() >= 2 || nowUTC.getUTCHours() < 8;
      
      if (isEveningMode) {
        // Evening mode: show tasks from today until 3 AM EST (8 AM UTC)
        const tomorrow3AMUTC = new Date(tomorrow);
        tomorrow3AMUTC.setUTCHours(8, 0, 0, 0);
        
        todayTasks = activeTasks.filter(task => {
          const taskDate = task.date_started ? new Date(task.date_started) : null;
          if (!taskDate) return false;
          return taskDate >= today && taskDate <= tomorrow3AMUTC;
        });
      } else {
        todayTasks = activeTasks.filter(task => {
          const taskDate = task.date_started ? new Date(task.date_started) : null;
          if (!taskDate) return false;
          return taskDate >= today && taskDate < tomorrow;
        });
      }
      
      if (todayTasks.length <= 1) {
        toast.error("Not enough tasks to shuffle");
        return;
      }
      
      const currentTask = todayTasks.find(t => t.Progress === 'In progress');
      const tasksToShuffle = todayTasks
        .filter(t => t.Progress !== 'Completed' && (!currentTask || t.id !== currentTask.id))
        .sort(() => Math.random() - 0.5);
      
      const currentTime = new Date();
      let nextStartTime: Date;
      
      if (currentTask) {
        const currentTaskEndTime = new Date(currentTask.date_due);
        nextStartTime = new Date(currentTaskEndTime.getTime() + 5 * 60 * 1000);
      } else if (tasksToShuffle.length > 0) {
        const firstTask = tasksToShuffle.shift();
        await supabase
          .from('Tasks')
          .update({
            Progress: 'In progress',
            date_started: currentTime.toISOString(),
            date_due: new Date(currentTime.getTime() + 25 * 60 * 1000).toISOString()
          })
          .eq('id', firstTask.id);
          
        nextStartTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
      } else {
        toast.error("No tasks available to shuffle");
        return;
      }
      
      for (const task of tasksToShuffle) {
        const taskStartTime = new Date(nextStartTime);
        const taskEndTime = new Date(taskStartTime.getTime() + 25 * 60 * 1000);
        
        await supabase
          .from('Tasks')
          .update({
            Progress: 'Not started',
            date_started: taskStartTime.toISOString(),
            date_due: taskEndTime.toISOString()
          })
          .eq('id', task.id);
        
        nextStartTime = new Date(taskEndTime.getTime() + 5 * 60 * 1000);
      }
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Tasks shuffled successfully');
    } catch (error) {
      console.error('Error shuffling tasks:', error);
      toast.error('Failed to shuffle tasks');
    }
  };
  
  return (
    <>
      <TaskScheduler onShuffleTasks={handleShuffleTasks} />
      <GoalNotificationsPanel 
        notifications={goalNotifications} 
        isLoading={isLoadingNotifications} 
      />
    </>
  );
};

export default Index;
