
import { useState, useEffect } from 'react';

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
    if (nextTask) {
      const now = new Date();
      const startTime = new Date(nextTask.date_started);
      const timeDiff = startTime.getTime() - now.getTime();
      // Show the timer if the next task starts within the next 10 minutes
      return timeDiff <= 10 * 60 * 1000 && timeDiff > 0;
    }

    return false;
  };

  useEffect(() => {
    setIsVisible(shouldShowTimer());
  }, [currentTask, isCountdownToNextTask]);

  return isVisible;
};
