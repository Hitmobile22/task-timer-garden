
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

  // Filter archived tasks
  filteredTasks = filteredTasks.filter(task => showArchived ? task.archived : !task.archived);
  
  // Filter by search query
  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(task => 
      task["Task Name"]?.toLowerCase().includes(searchLower)
    );
  }
  
  // Filter by progress status
  if (progressFilter.length > 0) {
    filteredTasks = filteredTasks.filter(task => 
      progressFilter.includes(task.Progress)
    );
  }
  
  // Sort tasks
  if (sortBy === 'date') {
    return filteredTasks.sort((a, b) => {
      const aDate = a.date_started ? new Date(a.date_started) : new Date(0);
      const bDate = b.date_started ? new Date(b.date_started) : new Date(0);
      return bDate.getTime() - aDate.getTime();
    });
  }

  // Sort by list and project
  return filteredTasks.sort((a, b) => {
    // First sort by task list
    if (a.task_list_id !== b.task_list_id) {
      // Handle null task_list_id (default list) by treating it as -1
      const aListId = a.task_list_id ?? -1;
      const bListId = b.task_list_id ?? -1;
      return aListId - bListId;
    }
    // Then sort by project within the same list
    if (a.project_id !== b.project_id) {
      // Handle null project_id by treating it as -1
      const aProjectId = a.project_id ?? -1;
      const bProjectId = b.project_id ?? -1;
      return aProjectId - bProjectId;
    }
    // Finally sort by task order within the same project
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
};

export const getFilteredProjects = (
  projects: Project[] | undefined,
  searchQuery: string,
  progressFilter: Task['Progress'][]
) => {
  if (!projects) return [];
  
  let filtered = [...projects];
  
  // Filter by search query
  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase();
    filtered = filtered.filter(project => 
      project["Project Name"].toLowerCase().includes(searchLower)
    );
  }
  
  // Filter by progress status
  if (progressFilter.length > 0) {
    filtered = filtered.filter(project => 
      progressFilter.includes(project.progress)
    );
  }
  
  // Sort projects by their sort order
  return filtered.sort((a, b) => {
    // First sort by task list
    if (a.task_list_id !== b.task_list_id) {
      // Handle null task_list_id (default list) by treating it as -1
      const aListId = a.task_list_id ?? -1;
      const bListId = b.task_list_id ?? -1;
      return aListId - bListId;
    }
    // Then sort by sort_order within the same list
    return a.sort_order - b.sort_order;
  });
};
