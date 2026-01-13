
import { getCurrentDayName } from "@/lib/utils";
import { toZonedTime } from 'date-fns-tz';

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

// Initialize from localStorage on module load
(() => {
  try {
    // Load last daily goal reset date
    const storedDailyResetStr = localStorage.getItem('last_daily_goals_reset');
    if (storedDailyResetStr) {
      globalState.lastDailyGoalResetDay = new Date(storedDailyResetStr);
    }
    
    // Load toast notification flag
    const hasShownResetToast = localStorage.getItem('has_shown_daily_reset_toast');
    if (hasShownResetToast === 'true') {
      globalState.hasShownDailyResetToast = true;
    }
  } catch (err) {
    console.error('Error initializing recurring utils from localStorage:', err);
  }
})();

// Getters and setters for the global state
export const getLastGlobalCheck = () => globalState.lastGlobalCheck;
export const getIsGlobalCheckInProgress = () => globalState.isGlobalCheckInProgress;
export const setIsGlobalCheckInProgress = (value: boolean) => { globalState.isGlobalCheckInProgress = value; };
export const getLastFullCheck = () => globalState.lastFullCheck;

export const getLastDailyGoalResetDay = () => globalState.lastDailyGoalResetDay;
export const setLastDailyGoalResetDay = (date: Date) => { 
  globalState.lastDailyGoalResetDay = date;
  try {
    localStorage.setItem('last_daily_goals_reset', date.toISOString());
  } catch (err) {
    console.error('Error saving last daily goal reset to localStorage:', err);
  }
};

export const getHasShownDailyResetToast = () => globalState.hasShownDailyResetToast;
export const setHasShownDailyResetToast = (value: boolean) => { 
  globalState.hasShownDailyResetToast = value;
  try {
    localStorage.setItem('has_shown_daily_reset_toast', value ? 'true' : 'false');
  } catch (err) {
    console.error('Error saving daily reset toast flag to localStorage:', err);
  }
};

export const getTaskListGenerationCache = () => globalState.taskListGenerationCache;

// Reset toast notification state at 3 AM EST (day boundary)
export const resetToastStateAtMidnight = () => {
  const now = new Date();
  const estNow = toZonedTime(now, 'America/New_York');
  const estHour = estNow.getHours();
  
  // Get the EST day start (3 AM boundary)
  const dayStartEST = new Date(estNow);
  if (estHour < 3) {
    dayStartEST.setDate(dayStartEST.getDate() - 1);
  }
  dayStartEST.setHours(3, 0, 0, 0);
  
  const resetDate = new Date(globalState.lastDailyGoalResetDay);
  const resetDateEST = toZonedTime(resetDate, 'America/New_York');
  
  // If the reset was before today's 3 AM EST boundary, clear the toast flag
  if (resetDateEST.getTime() < dayStartEST.getTime()) {
    setHasShownDailyResetToast(false);
  }
};

// Improved cache system for task list generation
export const setTaskListGenerated = (listId: number, date: Date = new Date()) => {
  if (!listId) return;
  
  console.log(`Marking task list ${listId} as generated for today (${date.toISOString()})`);
  globalState.taskListGenerationCache.set(listId, date);
  
  // Also store in localStorage for persistence across page refreshes
  try {
    const cacheData = JSON.parse(localStorage.getItem('task_list_generation_cache') || '{}');
    cacheData[listId] = date.toISOString();
    localStorage.setItem('task_list_generation_cache', JSON.stringify(cacheData));
    console.log(`Updated localStorage cache for list ${listId}`);
  } catch (error) {
    console.error('Error updating localStorage cache:', error);
  }
};

// More strict checking if a task list has been generated today (using 3 AM EST boundary)
export const hasTaskListBeenGeneratedToday = (listId: number): boolean => {
  if (!listId) return false;
  
  // Get EST day boundaries (day starts at 3 AM EST)
  const now = new Date();
  const estNow = toZonedTime(now, 'America/New_York');
  const estHour = estNow.getHours();
  
  const dayStartEST = new Date(estNow);
  if (estHour < 3) {
    dayStartEST.setDate(dayStartEST.getDate() - 1);
  }
  dayStartEST.setHours(3, 0, 0, 0);
  
  // First try localStorage for persistence across page refreshes
  try {
    const cacheData = JSON.parse(localStorage.getItem('task_list_generation_cache') || '{}');
    if (cacheData[listId]) {
      const cachedDate = new Date(cacheData[listId]);
      const cachedDateEST = toZonedTime(cachedDate, 'America/New_York');
      
      // Check if cached date is after today's 3 AM EST boundary
      const result = cachedDateEST.getTime() >= dayStartEST.getTime();
      if (result) {
        console.log(`Task list ${listId} was generated today (from localStorage cache, 3AM EST boundary): ${cachedDate}`);
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
  
  const cachedDateEST = toZonedTime(cachedDate, 'America/New_York');
  const result = cachedDateEST.getTime() >= dayStartEST.getTime();
  console.log(`Checking if task list ${listId} was generated today (3AM EST boundary): ${result} (cached: ${cachedDate.toISOString()})`);
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

// Check if it's daytime hours for running checks (7 AM - 9 PM EST)
export const isDaytimeHours = (): boolean => {
  const estNow = toZonedTime(new Date(), 'America/New_York');
  const estHour = estNow.getHours();
  return estHour >= 7 && estHour < 21;
};

// Early morning check (before 7 AM EST don't generate tasks)
export const isTooEarlyForTaskGeneration = (): boolean => {
  const estNow = toZonedTime(new Date(), 'America/New_York');
  const estHour = estNow.getHours();
  return estHour < 7;
};

// Late evening check (9 PM EST or later don't generate tasks)
export const isTooLateForTaskGeneration = (): boolean => {
  const estNow = toZonedTime(new Date(), 'America/New_York');
  const estHour = estNow.getHours();
  return estHour >= 21;
};

// Check if we're within the valid generation window (7 AM - 9 PM EST)
export const isWithinGenerationWindow = (): boolean => {
  const estNow = toZonedTime(new Date(), 'America/New_York');
  const estHour = estNow.getHours();
  return estHour >= 7 && estHour < 21;
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

// Reset the generation cache for a new day (using 3 AM EST boundary)
export const resetGenerationCacheIfNewDay = () => {
  const now = new Date();
  const estNow = toZonedTime(now, 'America/New_York');
  const estHour = estNow.getHours();
  
  // Get today's 3 AM EST boundary
  const dayStartEST = new Date(estNow);
  if (estHour < 3) {
    dayStartEST.setDate(dayStartEST.getDate() - 1);
  }
  dayStartEST.setHours(3, 0, 0, 0);
  
  // Check if we've stored the last reset date
  const lastResetKey = 'last_cache_reset_date';
  const lastResetStr = localStorage.getItem(lastResetKey);
  const lastReset = lastResetStr ? new Date(lastResetStr) : null;
  
  // If we haven't reset since today's 3 AM EST, clear the cache
  if (!lastReset) {
    console.log('No previous cache reset, clearing task generation cache');
    globalState.taskListGenerationCache.clear();
    localStorage.removeItem('task_list_generation_cache');
    localStorage.setItem(lastResetKey, dayStartEST.toISOString());
  } else {
    const lastResetEST = toZonedTime(lastReset, 'America/New_York');
    if (lastResetEST.getTime() < dayStartEST.getTime()) {
      console.log('New day detected (3 AM EST boundary), clearing task generation cache');
      globalState.taskListGenerationCache.clear();
      localStorage.removeItem('task_list_generation_cache');
      localStorage.setItem(lastResetKey, dayStartEST.toISOString());
    }
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

