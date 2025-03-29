
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const setupFullscreenHandlers = (
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>,
  shouldBeFullscreen: React.MutableRefObject<boolean>,
  isTransitioning: React.MutableRefObject<boolean>
) => {
  const handleFullscreenChange = () => {
    if (!isTransitioning.current) {
      const isNowFullscreen = document.fullscreenElement !== null;
      setIsFullscreen(isNowFullscreen);
      shouldBeFullscreen.current = isNowFullscreen;
      console.log("Fullscreen state updated externally:", isNowFullscreen);
      
      if (isNowFullscreen) {
        localStorage.setItem('pomodoroFullscreen', 'true');
      } else if (localStorage.getItem('pomodoroFullscreen') === 'true') {
        localStorage.removeItem('pomodoroFullscreen');
      }
    } else {
      console.log("Ignoring fullscreen change during transition");
    }
  };

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
};

export const restoreFullscreen = async (
  requestFullscreenSafely: (element: HTMLElement | null) => Promise<boolean>,
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>,
  shouldBeFullscreen: React.MutableRefObject<boolean>,
  element: HTMLElement | null
) => {
  const wasFullscreen = localStorage.getItem('pomodoroFullscreen') === 'true';
  if (wasFullscreen && !document.fullscreenElement) {
    setTimeout(() => {
      shouldBeFullscreen.current = true;
      requestFullscreenSafely(element).then(success => {
        if (success) {
          setIsFullscreen(true);
        }
      });
    }, 800); // Increased delay for better chance of success
  }
};

// New utility function to calculate time until next task starts
export const calculateTimeUntilTaskStart = (taskStartTime: string | Date): number | null => {
  if (!taskStartTime) return null;
  
  const now = new Date();
  const startTime = new Date(taskStartTime);
  const diffInSeconds = Math.floor((startTime.getTime() - now.getTime()) / 1000);
  
  if (diffInSeconds <= 0) return null;
  return diffInSeconds;
};
