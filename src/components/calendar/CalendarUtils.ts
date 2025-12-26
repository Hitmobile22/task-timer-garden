import { CalendarEvent, Task, Project, CalendarEventProgress } from '@/types/calendar.types';

export const getTasksForDay = (tasks: Task[] | undefined, date: Date): Task[] => {
  if (!tasks) return [];
  return tasks.filter(task => {
    if (!task.date_started || !task.date_due) return false;
    
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

export const getProjectsForDay = (projects: Project[] | undefined, date: Date): Project[] => {
  if (!projects) return [];
  return projects.filter(project => {
    if (!project.date_due) return false;
    
    const dueDate = new Date(project.date_due);
    const checkDate = new Date(date);
    
    checkDate.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);
    
    return dueDate.getTime() === checkDate.getTime();
  });
};

export const getEventsForDay = (
  tasks: Task[] | undefined, 
  projects: Project[] | undefined, 
  date: Date
): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  
  // Add projects as all-day events
  const dayProjects = getProjectsForDay(projects, date);
  dayProjects.forEach(project => {
    events.push({
      id: project.id,
      name: project["Project Name"],
      type: 'project',
      progress: project.progress || 'Not started',
      date_started: project.date_started,
      date_due: project.date_due!,
      isAllDay: true,
    });
  });
  
  // Add tasks as timed events
  const dayTasks = getTasksForDay(tasks, date);
  dayTasks.forEach(task => {
    events.push({
      id: task.id,
      name: task["Task Name"] || 'Untitled Task',
      type: 'task',
      progress: task.Progress || 'Not started',
      date_started: task.date_started,
      date_due: task.date_due!,
      isAllDay: false,
    });
  });
  
  return events;
};

export const getEventColor = (progress: CalendarEventProgress, type: 'task' | 'project' = 'task'): string => {
  if (type === 'project') {
    switch (progress) {
      case 'Completed':
        return 'bg-emerald-600';
      case 'In progress':
        return 'bg-violet-600';
      case 'Not started':
        return 'bg-amber-600';
      default:
        return 'bg-slate-600';
    }
  }
  
  switch (progress) {
    case 'Completed':
      return 'bg-emerald-500';
    case 'In progress':
      return 'bg-blue-500';
    case 'Not started':
      return 'bg-orange-500';
    case 'Backlog':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
};

// Legacy function for backwards compatibility
export const getTaskColor = (progress: CalendarEventProgress): string => {
  return getEventColor(progress, 'task');
};
