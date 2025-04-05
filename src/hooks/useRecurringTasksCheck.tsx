
import { useUnifiedRecurringTasksCheck } from './useUnifiedRecurringTasksCheck';
import { resetGenerationCacheIfNewDay } from '@/utils/recurringUtils';

/**
 * Hook to check and trigger recurring tasks generation
 * This is a wrapper around the unified recurring tasks check
 * to maintain backwards compatibility, with additional safeguards
 */
export const useRecurringTasksCheck = () => {
  const unifiedChecker = useUnifiedRecurringTasksCheck();
  
  // Add safety measure to check and reset the cache if it's a new day
  // This helps prevent issues with stale cache data
  resetGenerationCacheIfNewDay();
  
  // Pass through the functionality from the unified checker
  return {
    checkRecurringTasks: unifiedChecker.checkRecurringTasks,
    isChecking: unifiedChecker.isChecking,
    lastCheckedTime: unifiedChecker.lastCheckedTime,
    forceCheck: unifiedChecker.forceCheck
  };
};
