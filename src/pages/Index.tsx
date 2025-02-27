
import { TaskScheduler } from '@/components/TaskScheduler';
import { useRecurringTasksCheck } from '@/hooks/useRecurringTasksCheck';
import { useRecurringProjectsCheck } from '@/hooks/useRecurringProjectsCheck';

const Index = () => {
  useRecurringTasksCheck();
  useRecurringProjectsCheck();
  
  return <TaskScheduler />;
};

export default Index;
