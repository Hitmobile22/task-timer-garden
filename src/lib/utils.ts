
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function fetchSubtasksFromAI(taskName: string): Promise<string[]> {
  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5-coder:3b",
        prompt: `Provide a JSON response with exactly four subtasks to fully accomplish the task in 25 minutes: '${taskName}'. Format it like this: { "subtasks": ["Subtask 1", "Subtask 2", "Subtask 3", "Subtask 4] your response should be practical, knowledgable and demonstrate understanding of the context of the task}`,
        stream: false,
      }),
    });

    const data = await response.json();

    // Extract JSON response correctly even if extra text is included
    const jsonMatch = data.response.match(/\{.*\}/s);
    if (jsonMatch) {
      const parsedData = JSON.parse(jsonMatch[0]);
      return parsedData.subtasks || [];
    }

    return [];
  } catch (error) {
    console.error("Error fetching AI-generated subtasks:", error);
    return [];
  }
}

/**
 * Checks if two dates are on the same day
 */
export function areDatesOnSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Gets the current day name (e.g., 'Monday', 'Tuesday', etc.)
 */
export function getCurrentDayName(): string {
  // Use the en-US locale to ensure consistent day names that match our stored values
  // This ensures we always get 'Monday', 'Tuesday', etc. regardless of user locale
  return new Date().toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Start of day - returns a new Date set to the beginning of the given date's day
 */
export function startOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

/**
 * End of day - returns a new Date set to the end of the given date's day
 */
export function endOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

/**
 * Start of tomorrow - returns a new Date set to the beginning of tomorrow
 */
export function startOfTomorrow(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return startOfDay(tomorrow);
}

/**
 * Format a date range for display (e.g., "9:00 AM - 9:30 AM")
 */
export function formatTimeRange(startDate: Date, endDate: Date): string {
  return `${startDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })} - ${endDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })}`;
}

/**
 * Gets an ISO date string for the current day at midnight
 * This is useful for consistent date comparisons in database queries
 */
export function getTodayISOString(): string {
  return startOfDay(new Date()).toISOString();
}

/**
 * Gets an ISO date string for tomorrow at midnight
 */
export function getTomorrowISOString(): string {
  return startOfTomorrow().toISOString();
}

/**
 * Formats a date in ISO format for consistent database storage
 */
export function formatDateForDB(date: Date): string {
  return date.toISOString();
}

/**
 * Creates a debounced function that only invokes the provided function
 * after the specified wait time has elapsed since the last time it was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = window.setTimeout(later, wait);
  };
}

/**
 * Creates a throttled function that only invokes the provided function
 * at most once per every wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastCallTime = 0;
  
  return function(...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;
    
    lastArgs = args;
    
    if (timeSinceLastCall >= wait) {
      // If enough time has passed, call the function immediately
      lastCallTime = now;
      func(...args);
    } else if (timeout === null) {
      // Otherwise, schedule a call for later
      timeout = window.setTimeout(() => {
        lastCallTime = Date.now();
        timeout = null;
        
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, wait - timeSinceLastCall);
    }
  };
}

/**
 * Calculates the number of calendar days between two dates
 * Uses midnight normalization to ensure accurate day counting
 */
export function daysBetween(date1: Date, date2: Date): number {
  // Normalize both dates to midnight to compare calendar days, not time
  const d1 = startOfDay(date1);
  const d2 = startOfDay(date2);
  const oneDay = 24 * 60 * 60 * 1000;
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / oneDay);
}

/**
 * Formats a date in a friendly format (e.g., "3 days left", "Due tomorrow", "Due today")
 */
export function formatDueDateStatus(dueDate: Date): string {
  const today = new Date();
  const days = daysBetween(today, dueDate);
  
  if (areDatesOnSameDay(today, dueDate)) {
    return "Due today";
  } else if (dueDate < today) {
    return days === 1 ? "Overdue by 1 day" : `Overdue by ${days} days`;
  } else {
    if (days === 1) return "Due tomorrow";
    return `${days} days left`;
  }
}
