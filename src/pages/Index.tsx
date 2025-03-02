
import { TaskScheduler } from '@/components/TaskScheduler';
import { useRecurringTasksCheck } from '@/hooks/useRecurringTasksCheck';
import { useRecurringProjectsCheck } from '@/hooks/useRecurringProjectsCheck';

const Index = () => {
  // Initialize hooks for recurring tasks check
  useRecurringTasksCheck();
  
  // We don't need to call this again since it's already called inside TaskScheduler
  // but leaving here for clarity
  useRecurringProjectsCheck();
  
  return <TaskScheduler />;
};

export default Index;
