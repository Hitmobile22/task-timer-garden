
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
