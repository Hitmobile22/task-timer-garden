import { format } from 'date-fns';
import { TASK_LIST_COLORS } from '@/constants/taskColors';
import { Json } from '@/integrations/supabase/types';

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

export const extractSolidColorFromGradient = (gradient: string): string => {
  if (!gradient) return '#8E9196'; // Fallback color
  
  const hexMatch = gradient.match(/#[a-fA-F0-9]{6}/g);
  if (hexMatch && hexMatch.length > 0) {
    return hexMatch[0];
  }
  
  const hslaMatch = gradient.match(/hsla\(\s*(\d+\.?\d*)\s*,\s*(\d+\.?\d*)%\s*,\s*(\d+\.?\d*)%\s*,\s*(\d+\.?\d*)\s*\)/);
  if (hslaMatch) {
    const h = parseFloat(hslaMatch[1]);
    const sPercent = parseFloat(hslaMatch[2]);
    const lPercent = parseFloat(hslaMatch[3]);
    
    const sDecimal = sPercent / 100;
    const lDecimal = lPercent / 100;
    
    const k = (n: number) => (n + h / 30) % 12;
    const a = sDecimal * Math.min(lDecimal, 1 - lDecimal);
    const f = (n: number) => lDecimal - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const rgb = [255 * f(0), 255 * f(8), 255 * f(4)];
    
    const hex = `#${rgb.map(x => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
    return hex;
  }
  
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
  
  if (typeof task.details === 'string') {
    try {
      const parsedDetails = JSON.parse(task.details);
      return 'isTimeBlock' in parsedDetails && Boolean(parsedDetails.isTimeBlock);
    } catch (e) {
      return false;
    }
  }
  
  if (typeof task.details === 'object' && task.details !== null) {
    return 'isTimeBlock' in task.details && Boolean(task.details.isTimeBlock);
  }
  
  return false;
};

/**
 * Safely checks if a task is in backlog
 */
export const isTaskInBacklog = (task: any): boolean => {
  return task?.Progress === 'Backlog';
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
  
  // Convert EST evening mode (9 PM - 3 AM) to UTC for proper comparison
  // 9 PM EST = 2 AM UTC next day, 3 AM EST = 8 AM UTC
  const nowUTC = new Date(now.toISOString());
  const isEveningMode = nowUTC.getUTCHours() >= 2 || nowUTC.getUTCHours() < 8;
  
  if (isEveningMode) {
    const tomorrow3AMUTC = new Date(tomorrow);
    tomorrow3AMUTC.setUTCHours(8, 0, 0, 0);
    
    return taskStartDate > tomorrow3AMUTC;
  }
  
  return taskStartDate >= tomorrow;
};

/**
 * Determines if a task can be rescheduled or not (time blocks can still be rescheduled)
 */
export const canTaskBeRescheduled = (task: any): boolean => {
  return true;
};

/**
 * Checks if a task is the current active task in progress
 */
export const isCurrentTask = (task: any): boolean => {
  return task?.Progress === 'In progress';
};
