
import { useProjectGoalInitialCount } from '@/hooks/useProjectGoalInitialCount';
import { useRecurringProjectsCheck } from '@/hooks/useRecurringProjectsCheck';
import { useRecurringTasksCheck } from '@/hooks/useRecurringTasksCheck';

/**
 * A component that runs initialization and background processes
 * This component doesn't render anything visible
 */
export const InitializationComponent: React.FC = () => {
  // Initialize goal counts
  useProjectGoalInitialCount();
  
  // Set up recurring checks
  useRecurringProjectsCheck();
  useRecurringTasksCheck();
  
  return null; // This component doesn't render anything
};
