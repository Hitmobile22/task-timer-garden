
import { getCurrentDayName } from "@/lib/utils";

// Create a module state object to keep track of state
const globalState = {
  // Map to track the last check time for any project to prevent multiple checks
  lastGlobalCheck: new Map<number, Date>(),

  // Global check state to prevent multiple instances from running checks simultaneously
  isGlobalCheckInProgress: false,

  // Global map to track the last check time for task lists to prevent multiple checks
  lastFullCheck: {
    timestamp: new Date(0),
    inProgress: false
  },

  // Track the last day we reset daily goals
  lastDailyGoalResetDay: new Date(0),
  
  // Track whether we've already shown the daily reset toast notification
  hasShownDailyResetToast: false,
  
  // Task list generation cache to prevent duplicate task creation within one day
  taskListGenerationCache: new Map<number, Date>()
};

// Getters and setters for the global state
export const getLastGlobalCheck = () => globalState.lastGlobalCheck;
export const getIsGlobalCheckInProgress = () => globalState.isGlobalCheckInProgress;
export const setIsGlobalCheckInProgress = (value: boolean) => { globalState.isGlobalCheckInProgress = value; };
export const getLastFullCheck = () => globalState.lastFullCheck;
export const getLastDailyGoalResetDay = () => globalState.lastDailyGoalResetDay;
export const setLastDailyGoalResetDay = (date: Date) => { globalState.lastDailyGoalResetDay = date; };
export const getHasShownDailyResetToast = () => globalState.hasShownDailyResetToast;
export const setHasShownDailyResetToast = (value: boolean) => { globalState.hasShownDailyResetToast = value; };
export const getTaskListGenerationCache = () => globalState.taskListGenerationCache;
export const setTaskListGenerated = (listId: number, date: Date = new Date()) => {
  globalState.taskListGenerationCache.set(listId, date);
};
export const hasTaskListBeenGeneratedToday = (listId: number): boolean => {
  const cachedDate = globalState.taskListGenerationCache.get(listId);
  if (!cachedDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cachedDay = new Date(cachedDate);
  cachedDay.setHours(0, 0, 0, 0);
  
  return cachedDay.getTime() === today.getTime();
};

// Helper function to normalize day names for consistent comparison
export const normalizeDay = (day: string): string => 
  day?.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase()) || '';

// Get the current day name and normalize it for consistent comparison
export const getCurrentNormalizedDay = (): string => {
  const currentDayName = getCurrentDayName();
  return normalizeDay(currentDayName);
};

// Check if it's daytime hours for running checks
export const isDaytimeHours = (): boolean => {
  const currentHour = new Date().getHours();
  return currentHour >= 7 && currentHour < 22;
};

// Early morning check (before 7am don't generate tasks)
export const isTooEarlyForTaskGeneration = (): boolean => {
  const currentHour = new Date().getHours();
  return currentHour < 7;
};

// Check if enough time has passed since the last check (rate limiting)
export const shouldRateLimitCheck = (
  lastCheckTime: Date | undefined, 
  forceCheck: boolean = false,
  rateLimitMs: number = 15 * 60 * 1000 // Default: 15 minutes
): boolean => {
  if (forceCheck) return false; // Skip rate limiting if force check
  
  const now = new Date();
  if (!lastCheckTime) return false;
  
  const timeSinceLastCheck = now.getTime() - lastCheckTime.getTime();
  return timeSinceLastCheck < rateLimitMs;
};
