import { format } from 'date-fns';
import { TASK_LIST_COLORS } from '@/constants/taskColors';

export const generateRandomColor = () => {
  // Create a more vibrant and varied random gradient
  const hue1 = Math.random() * 360;
  const hue2 = (hue1 + 40 + Math.random() * 80) % 360; // offset by 40-120 degrees
  
  const saturation1 = 70 + Math.random() * 20;
  const saturation2 = 70 + Math.random() * 20;
  
  const lightness1 = 45 + Math.random() * 15;
  const lightness2 = 45 + Math.random() * 15;
  
  return `linear-gradient(135deg, hsla(${hue1}, ${saturation1}%, ${lightness1}%, 0.8) 0%, hsla(${hue2}, ${saturation2}%, ${lightness2}%, 0.8) 100%)`;
};

export const getTaskListColor = (listId: number, taskLists: any[]) => {
  if (!listId) return TASK_LIST_COLORS['Default'];
  
  // Find the task list with the matching ID
  const list = taskLists?.find(l => l.id === listId);
  
  // If we have a list and it has a name that matches one of our predefined colors
  if (list && list.name && TASK_LIST_COLORS[list.name as keyof typeof TASK_LIST_COLORS]) {
    return TASK_LIST_COLORS[list.name as keyof typeof TASK_LIST_COLORS];
  }
  
  // If the list has a custom color, use that
  if (list && list.color) {
    return list.color;
  }
  
  // Otherwise, return the default color
  return TASK_LIST_COLORS['Default'];
};

export const formatDate = (date: string) => {
  return format(new Date(date), 'MMM d, h:mm a');
};
