
import { format } from 'date-fns';
import { TASK_LIST_COLORS } from '@/constants/taskColors';

export const generateRandomColor = () => {
  const hue = Math.random() * 360;
  return `linear-gradient(90deg, hsla(${hue}, 70%, 75%, 1) 0%, hsla(${(hue + 30) % 360}, 90%, 76%, 1) 100%)`;
};

export const getTaskListColor = (listId: number, taskLists: any[]) => {
  if (!listId || !taskLists || taskLists.length === 0) {
    return TASK_LIST_COLORS['Default'];
  }
  
  const list = taskLists.find(l => l.id === listId);
  return list?.color || TASK_LIST_COLORS['Default'];
};

// Helper to extract a solid color from a gradient string
export const extractSolidColorFromGradient = (gradient: string): string => {
  if (!gradient) return '#8E9196'; // Fallback color
  
  // Try to extract hex color
  const hexMatch = gradient.match(/#[a-fA-F0-9]{6}/g);
  if (hexMatch && hexMatch.length > 0) {
    return hexMatch[0];
  }
  
  // Try to extract hsla color and convert to hex
  const hslaMatch = gradient.match(/hsla\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)%\s*,\s*(\d+\.?\d*)%\s*,\s*(\d+\.?\d*)\s*\)/);
  if (hslaMatch) {
    const h = parseFloat(hslaMatch[1]);
    // Use new variables instead of modifying the const variables
    const sPercent = parseFloat(hslaMatch[2]);
    const lPercent = parseFloat(hslaMatch[3]);
    
    // Convert percentages to decimal values
    const sDecimal = sPercent / 100;
    const lDecimal = lPercent / 100;
    
    // Convert HSLA to RGB
    const k = (n: number) => (n + h / 30) % 12;
    const a = sDecimal * Math.min(lDecimal, 1 - lDecimal);
    const f = (n: number) => lDecimal - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const rgb = [255 * f(0), 255 * f(8), 255 * f(4)];
    
    // Convert to hex
    const hex = `#${rgb.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
    return hex;
  }
  
  // Try to extract rgb/rgba
  const rgbMatch = gradient.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*\d*\.?\d+\s*)?\)/g);
  if (rgbMatch && rgbMatch.length > 0) {
    return rgbMatch[0];
  }
  
  return '#8E9196'; // Fallback color
};

export const formatDate = (date: string) => {
  return format(new Date(date), 'MMM d, h:mm a');
};

/**
 * Helper function to safely check if a task is a time block
 */
export const isTaskTimeBlock = (task: any): boolean => {
  if (!task || !task.details) return false;
  
  // Handle string JSON
  if (typeof task.details === 'string') {
    try {
      const parsedDetails = JSON.parse(task.details);
      return !!parsedDetails.isTimeBlock;
    } catch (e) {
      return false;
    }
  }
  
  // Handle object
  if (typeof task.details === 'object' && task.details !== null) {
    return !!task.details.isTimeBlock;
  }
  
  return false;
};

/**
 * Checks if a task is scheduled for the future (beyond today)
 */
export const isTaskInFuture = (task: any): boolean => {
  if (!task || !task.date_started) return false;
  
  const taskStartDate = new Date(task.date_started);
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Late night logic (after 9PM until 5AM)
  if (now.getHours() >= 21 || now.getHours() < 5) {
    const tomorrow5AM = new Date(tomorrow);
    tomorrow5AM.setHours(5, 0, 0, 0);
    
    // During late night, consider tasks scheduled within this period as "today's tasks"
    return taskStartDate > tomorrow5AM;
  }
  
  // During normal hours, consider anything for tomorrow or later as "future"
  return taskStartDate >= tomorrow;
};

/**
 * Determines if a task can be rescheduled or not (time blocks cannot be rescheduled)
 */
export const canTaskBeRescheduled = (task: any): boolean => {
  return !isTaskTimeBlock(task);
};
