
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
  
  return `linear-gradient(135deg, hsla(${hue1}, ${saturation1}%, ${lightness1}%, 1) 0%, hsla(${hue2}, ${saturation2}%, ${lightness2}%, 1) 100%)`;
};

export const getTaskListColor = (listId: number, taskLists: any[]) => {
  const list = taskLists?.find(l => l.id === listId);
  return list?.color || TASK_LIST_COLORS['Default'] || generateRandomColor();
};

export const formatDate = (date: string) => {
  return format(new Date(date), 'MMM d, h:mm a');
};
