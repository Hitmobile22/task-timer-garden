
import { useUnifiedRecurringTasksCheck } from './useUnifiedRecurringTasksCheck';
import { resetGenerationCacheIfNewDay } from '@/utils/recurringUtils';
import { useEffect } from 'react';

/**
 * Hook to check and trigger recurring tasks generation
 * This is a wrapper around the unified recurring tasks check
 * to maintain backwards compatibility, with additional safeguards
 */
export const useRecurringTasksCheck = () => {
  const unifiedChecker = useUnifiedRecurringTasksCheck();
  
  // Add safety measure to check and reset the cache if it's a new day
  // This helps prevent issues with stale cache data
  useEffect(() => {
    // Reset generation cache if it's a new day whenever the hook is initialized
    resetGenerationCacheIfNewDay();
    
    // Also set up an interval to check periodically
    const interval = setInterval(() => {
      resetGenerationCacheIfNewDay();
    }, 15 * 60 * 1000); // Check every 15 minutes
    
    return () => clearInterval(interval);
  }, []);
  
  // Pass through the functionality from the unified checker
  return {
    checkRecurringTasks: unifiedChecker.checkRecurringTasks,
    isChecking: unifiedChecker.isChecking,
    lastCheckedTime: unifiedChecker.lastCheckedTime,
    forceCheck: unifiedChecker.forceCheck
  };
};
