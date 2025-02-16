
import { useState, useEffect } from 'react';

export const useTimerVisibility = (currentTask: any, getNextTask: () => any) => {
  const [isVisible, setIsVisible] = useState(true);

  const shouldShowTimer = () => {
    if (currentTask && new Date() >= new Date(currentTask.date_started)) {
      return true;
    }

    const nextTask = getNextTask();
    if (nextTask) {
      const now = new Date();
      const startTime = new Date(nextTask.date_started);
      const timeDiff = startTime.getTime() - now.getTime();
      return timeDiff <= 10 * 60 * 1000 && timeDiff > 0;
    }

    return false;
  };

  useEffect(() => {
    setIsVisible(shouldShowTimer());
  }, [currentTask, getNextTask]);

  return isVisible;
};
