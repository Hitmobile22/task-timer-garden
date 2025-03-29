import { useState, useEffect } from 'react';
import { shouldShowCountdownForTask } from '@/utils/timerUtils';

export const useTimerVisibility = (
  currentTask: any, 
  getNextTask: () => any,
  isCountdownToNextTask: boolean = false
) => {
  const [isVisible, setIsVisible] = useState(true);

  const shouldShowTimer = () => {
    // If we're already showing a countdown to next task, always show
    if (isCountdownToNextTask) return true;
    
    // If there's a current task, show the timer
    if (currentTask) return true;

    // Otherwise, check if we need to show a countdown for an upcoming task
    const nextTask = getNextTask();
    if (nextTask && nextTask.date_started) {
      // Only show the timer if the next task starts within exactly 10 minutes
      return shouldShowCountdownForTask(nextTask.date_started);
    }

    return false;
  };

  useEffect(() => {
    setIsVisible(shouldShowTimer());
  }, [currentTask, isCountdownToNextTask]);

  return isVisible;
};
