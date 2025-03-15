
import { Task } from '@/pages/Calendar';

export const getTasksForDay = (tasks: Task[] | undefined, date: Date): Task[] => {
  if (!tasks) return [];
  return tasks.filter(task => {
    const taskStart = new Date(task.date_started);
    const taskDue = new Date(task.date_due);
    const taskDate = new Date(date);
    
    taskDate.setHours(0, 0, 0, 0);
    const startDate = new Date(taskStart);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(taskDue);
    endDate.setHours(0, 0, 0, 0);
    
    return startDate <= taskDate && endDate >= taskDate;
  });
};

export const getTaskColor = (progress: Task['Progress']): string => {
  switch (progress) {
    case 'Completed':
      return 'bg-emerald-500';
    case 'In progress':
      return 'bg-blue-500';
    case 'Not started':
      return 'bg-orange-500';
    default:
      return 'bg-gray-500';
  }
};
