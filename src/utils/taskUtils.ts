
import { format } from 'date-fns';
import { TASK_LIST_COLORS } from '@/constants/taskColors';

export const generateRandomColor = () => {
  const hue = Math.random() * 360;
  return `linear-gradient(90deg, hsla(${hue}, 70%, 75%, 1) 0%, hsla(${(hue + 30) % 360}, 90%, 76%, 1) 100%)`;
};

export const getTaskListColor = (listId: number, taskLists: any[]) => {
  const list = taskLists?.find(l => l.id === listId);
  return list?.color || TASK_LIST_COLORS['Default'];
};

export const formatDate = (date: string) => {
  return format(new Date(date), 'MMM d, h:mm a');
};
