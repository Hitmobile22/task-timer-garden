
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

// Improved cache system for task list generation
export const setTaskListGenerated = (listId: number, date: Date = new Date()) => {
  console.log(`Marking task list ${listId} as generated for today (${date.toISOString()})`);
  globalState.taskListGenerationCache.set(listId, date);
  
  // Also store in localStorage for persistence across page refreshes
  try {
    const cacheData = JSON.parse(localStorage.getItem('task_list_generation_cache') || '{}');
    cacheData[listId] = date.toISOString();
    localStorage.setItem('task_list_generation_cache', JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error updating localStorage cache:', error);
  }
};

// More strict checking if a task list has been generated today
export const hasTaskListBeenGeneratedToday = (listId: number): boolean => {
  // First try localStorage for persistence across page refreshes
  try {
    const cacheData = JSON.parse(localStorage.getItem('task_list_generation_cache') || '{}');
    if (cacheData[listId]) {
      const cachedDate = new Date(cacheData[listId]);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cachedDay = new Date(cachedDate);
      cachedDay.setHours(0, 0, 0, 0);
      
      const result = cachedDay.getTime() === today.getTime();
      if (result) {
        console.log(`Task list ${listId} was generated today (from localStorage cache): ${cachedDate}`);
        // Also update memory cache
        globalState.taskListGenerationCache.set(listId, cachedDate);
        return true;
      }
    }
  } catch (error) {
    console.error('Error checking localStorage cache:', error);
  }
  
  // Fall back to memory cache
  const cachedDate = globalState.taskListGenerationCache.get(listId);
  if (!cachedDate) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cachedDay = new Date(cachedDate);
  cachedDay.setHours(0, 0, 0, 0);
  
  const result = cachedDay.getTime() === today.getTime();
  console.log(`Checking if task list ${listId} was generated today: ${result} (cached: ${cachedDate.toISOString()})`);
  return result;
};

// Helper function to normalize day names for consistent comparison
export const normalizeDay = (day: string): string => 
  day?.trim().toLowerCase().replace(/^\w/, c => c.toUpperCase()) || '';

// Get the current day name and normalize it for consistent comparison
export const getCurrentNormalizedDay = (): string => {
  const currentDayName = getCurrentDayName();
  return normalizeDay(currentDayName);
};

// Exact day matching function to determine if a specific day matches any in an array
export const isDayMatch = (currentDay: string, configuredDays: string[]): boolean => {
  if (!configuredDays || configuredDays.length === 0) return true; // No days specified means all days
  
  const normalizedCurrentDay = normalizeDay(currentDay);
  const normalizedConfiguredDays = configuredDays.map(normalizeDay);
  
  const isMatch = normalizedConfiguredDays.includes(normalizedCurrentDay);
  console.log(`Day match check: current day "${normalizedCurrentDay}" in [${normalizedConfiguredDays.join(', ')}] = ${isMatch}`);
  return isMatch;
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

// Reset the generation cache for a new day
export const resetGenerationCacheIfNewDay = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Check if we've stored the last reset date
  const lastResetKey = 'last_cache_reset_date';
  const lastResetStr = localStorage.getItem(lastResetKey);
  const lastReset = lastResetStr ? new Date(lastResetStr) : null;
  
  // If we haven't reset today, clear the cache
  if (!lastReset || lastReset.getTime() !== today.getTime()) {
    console.log('New day detected, clearing task generation cache');
    globalState.taskListGenerationCache.clear();
    localStorage.removeItem('task_list_generation_cache');
    localStorage.setItem(lastResetKey, today.toISOString());
  }
};

// Load cache from localStorage on module initialization
const initializeCache = () => {
  try {
    const cacheData = JSON.parse(localStorage.getItem('task_list_generation_cache') || '{}');
    for (const [listId, dateStr] of Object.entries(cacheData)) {
      globalState.taskListGenerationCache.set(Number(listId), new Date(dateStr as string));
    }
    console.log('Initialized task generation cache from localStorage');
  } catch (error) {
    console.error('Error loading cache from localStorage:', error);
  }
};

// Initialize cache on module load
initializeCache();

