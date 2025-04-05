
import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useUnifiedRecurringTasksCheck } from './useUnifiedRecurringTasksCheck';

/**
 * Hook to check and trigger recurring tasks generation
 * This is a wrapper around the unified recurring tasks check
 * to maintain backwards compatibility
 */
export const useRecurringTasksCheck = () => {
  const unifiedChecker = useUnifiedRecurringTasksCheck();
  
  // Pass through the functionality from the unified checker
  return {
    checkRecurringTasks: unifiedChecker.checkRecurringTasks,
    isChecking: unifiedChecker.isChecking,
    lastCheckedTime: unifiedChecker.lastCheckedTime,
    forceCheck: unifiedChecker.forceCheck
  };
};
