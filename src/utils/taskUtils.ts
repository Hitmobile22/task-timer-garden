
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
 * Handles all possible types of the details field from Supabase
 */
export const isTaskTimeBlock = (task: any): boolean => {
  if (!task) return false;
  
  // If details is null or undefined
  if (!task.details) return false;
  
  // Handle string JSON
  if (typeof task.details === 'string') {
    try {
      const parsedDetails = JSON.parse(task.details);
      return parsedDetails && typeof parsedDetails === 'object' && parsedDetails.isTimeBlock === true;
    } catch (e) {
      return false;
    }
  }
  
  // Handle object (could be a Record/object, number, boolean, etc from Json type)
  if (typeof task.details === 'object' && task.details !== null) {
    return 'isTimeBlock' in task.details && task.details.isTimeBlock === true;
  }
  
  return false;
};

/**
 * Check if a time range overlaps with a time block
 */
export const overlapsWithTimeBlock = (
  startTime: Date, 
  endTime: Date, 
  timeBlock: { start: Date, end: Date }
): boolean => {
  return (
    (startTime >= timeBlock.start && startTime < timeBlock.end) ||
    (endTime > timeBlock.start && endTime <= timeBlock.end) ||
    (startTime <= timeBlock.start && endTime >= timeBlock.end)
  );
};

/**
 * Find the next available time slot after time blocks
 */
export const findNextAvailableTime = (
  desiredStartTime: Date,
  taskDuration: number, // in minutes
  timeBlocks: Array<{ start: Date, end: Date }>
): Date => {
  let candidateTime = new Date(desiredStartTime);
  let found = false;
  
  // Sort time blocks by start time
  const sortedBlocks = [...timeBlocks].sort((a, b) => 
    a.start.getTime() - b.start.getTime()
  );
  
  while (!found) {
    found = true;
    const candidateEndTime = new Date(candidateTime.getTime() + taskDuration * 60 * 1000);
    
    for (const block of sortedBlocks) {
      if (overlapsWithTimeBlock(candidateTime, candidateEndTime, block)) {
        // Move candidate time to after this block with a 5-minute buffer
        candidateTime = new Date(block.end.getTime() + 5 * 60 * 1000);
        found = false;
        break;
      }
    }
  }
  
  return candidateTime;
};
