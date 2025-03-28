import { TaskScheduler } from '@/components/TaskScheduler';
import { useRecurringTasksCheck } from '@/hooks/useRecurringTasksCheck';
import { useRecurringProjectsCheck } from '@/hooks/useRecurringProjectsCheck';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import { GoalNotificationsPanel } from '@/components/goals/GoalNotificationsPanel';
import { useGoalNotifications } from '@/hooks/useGoalNotifications';

const Index = () => {
  useRecurringTasksCheck();
  useRecurringProjectsCheck();
  
  const queryClient = useQueryClient();
  const { data: goalNotifications = [], isLoading: isLoadingNotifications } = useGoalNotifications();
  
  const handleShuffleTasks = async () => {
    try {
      const { data: activeTasks, error } = await supabase
        .from('Tasks')
        .select('*')
        .neq('Progress', 'Completed')
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      if (!activeTasks || activeTasks.length === 0) {
        toast.error("No tasks available to shuffle");
        return;
      }
      
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const tomorrow5AM = new Date(tomorrow);
      tomorrow5AM.setHours(5, 0, 0, 0);
      
      let todayTasks;
      if (now.getHours() >= 21) {
        todayTasks = activeTasks.filter(task => {
          const taskDate = task.date_started ? new Date(task.date_started) : null;
          if (!taskDate) return false;
          return taskDate >= today && taskDate <= tomorrow5AM;
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
