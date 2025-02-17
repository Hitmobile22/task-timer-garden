
import { Task, Project } from '@/types/task.types';

export const getSortedAndFilteredTasks = (
  tasks: Task[] | undefined,
  showArchived: boolean,
  searchQuery: string,
  progressFilter: Task['Progress'][],
  sortBy: 'date' | 'list'
) => {
  if (!tasks) return [];
  
  let filteredTasks = [...tasks];

  filteredTasks = filteredTasks.filter(task => showArchived ? task.archived : !task.archived);
  
  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(task => 
      task["Task Name"]?.toLowerCase().includes(searchLower)
    );
  }
  
  if (progressFilter.length > 0) {
    filteredTasks = filteredTasks.filter(task => 
      progressFilter.includes(task.Progress)
    );
  }
  
  if (sortBy === 'date') {
    return filteredTasks.sort((a, b) => {
      const aDate = a.date_started ? new Date(a.date_started) : new Date(0);
      const bDate = b.date_started ? new Date(b.date_started) : new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
  }

  return filteredTasks.sort((a, b) => {
    if (a.project_id !== b.project_id) {
      return (a.project_id || 0) - (b.project_id || 0);
    }
    return (a.task_list_id || 0) - (b.task_list_id || 0);
  });
};

export const getFilteredProjects = (
  projects: Project[] | undefined,
  searchQuery: string,
  progressFilter: Task['Progress'][]
) => {
  if (!projects) return [];
  
  let filtered = [...projects];
  
  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase();
    filtered = filtered.filter(project => 
      project["Project Name"].toLowerCase().includes(searchLower)
    );
  }
  
  if (progressFilter.length > 0) {
    filtered = filtered.filter(project => 
      progressFilter.includes(project.progress)
    );
  }
  
  return filtered.sort((a, b) => a.sort_order - b.sort_order);
};
