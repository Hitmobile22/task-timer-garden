
import { TaskScheduler } from '@/components/TaskScheduler';
import { useRecurringTasksCheck } from '@/hooks/useRecurringTasksCheck';
import { useRecurringProjectsCheck } from '@/hooks/useRecurringProjectsCheck';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

const Index = () => {
  // Initialize hooks for recurring tasks check
  useRecurringTasksCheck();
  
  // We don't need to call this again since it's already called inside TaskScheduler
  // but leaving here for clarity
  useRecurringProjectsCheck();
  
  const queryClient = useQueryClient();
  
  // Function to shuffle today's tasks
  const handleShuffleTasks = async () => {
    try {
      // Fetch active tasks
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
      
      // Filter to only include today's tasks
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(5, 0, 0, 0); // 5am tomorrow cutoff
      
      // If it's before 5am, include tasks from 9pm yesterday
      const startTime = new Date(today);
      if (today.getHours() < 5) {
        startTime.setDate(startTime.getDate() - 1);
        startTime.setHours(21, 0, 0, 0); // 9pm yesterday
      } else {
        startTime.setHours(5, 0, 0, 0); // 5am today
      }
      
      const todayTasks = activeTasks.filter(task => {
        const taskDate = task.date_started ? new Date(task.date_started) : null;
        if (!taskDate) return false;
        return taskDate >= startTime && taskDate <= tomorrow;
      });
      
      if (todayTasks.length <= 1) {
        toast.error("Not enough tasks to shuffle");
        return;
      }
      
      // Find the current in-progress task
      const currentTask = todayTasks.find(t => t.Progress === 'In progress');
      const tasksToShuffle = todayTasks
        .filter(t => t.Progress !== 'Completed' && (!currentTask || t.id !== currentTask.id))
        .sort(() => Math.random() - 0.5); // Shuffle remaining tasks
      
      // Start scheduling from current time or after current task
      const currentTime = new Date();
      let nextStartTime: Date;
      
      if (currentTask) {
        const currentTaskEndTime = new Date(currentTask.date_due);
        nextStartTime = new Date(currentTaskEndTime.getTime() + 5 * 60 * 1000); // 5 min break after current task
      } else if (tasksToShuffle.length > 0) {
        // If no current task, make the first shuffled task the current one
        const firstTask = tasksToShuffle.shift();
        await supabase
          .from('Tasks')
          .update({
            Progress: 'In progress',
            date_started: currentTime.toISOString(),
            date_due: new Date(currentTime.getTime() + 25 * 60 * 1000).toISOString()
          })
          .eq('id', firstTask.id);
          
        nextStartTime = new Date(currentTime.getTime() + 30 * 60 * 1000); // 30 min after (25 min task + 5 min break)
      } else {
        toast.error("No tasks available to shuffle");
        return;
      }
      
      // Update all remaining tasks with new shuffled schedule
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
        
        nextStartTime = new Date(taskEndTime.getTime() + 5 * 60 * 1000); // 5 min break
      }
      
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Tasks shuffled successfully');
    } catch (error) {
      console.error('Error shuffling tasks:', error);
      toast.error('Failed to shuffle tasks');
    }
  };
  
  return <TaskScheduler onShuffleTasks={handleShuffleTasks} />;
};

export default Index;
