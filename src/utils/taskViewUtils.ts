
import { Task, Project } from '@/types/task.types';

export const getSortedAndFilteredTasks = (
  tasks: Task[] | undefined,
  showArchived: boolean,
  searchQuery: string,
  progressFilter: Task['Progress'][],
  sortBy: 'date' | 'list'
) => {
  if (!tasks) return [];
  
  console.log('Initial tasks:', tasks); // Debug log
  
  let filteredTasks = [...tasks];

  // Filter archived tasks
  filteredTasks = filteredTasks.filter(task => showArchived ? true : !task.archived);
  console.log('After archive filter:', filteredTasks); // Debug log
  
  // Filter by search query
  if (searchQuery) {
    const searchLower = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(task => 
      task["Task Name"]?.toLowerCase().includes(searchLower)
    );
  }
  console.log('After search filter:', filteredTasks); // Debug log
  
  // Filter by progress status
  if (progressFilter.length > 0) {
    filteredTasks = filteredTasks.filter(task => 
      progressFilter.includes(task.Progress)
    );
  }
  console.log('After progress filter:', filteredTasks); // Debug log
  
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
    const aListId = a.task_list_id ?? -1;
    const bListId = b.task_list_id ?? -1;
    if (aListId !== bListId) {
      return aListId - bListId;
    }
    // Then sort by project within the same list
    const aProjectId = a.project_id ?? -1;
    const bProjectId = b.project_id ?? -1;
    if (aProjectId !== bProjectId) {
      return aProjectId - bProjectId;
    }
    // Finally sort by order within the same project
    return (a.order ?? 0) - (b.order ?? 0);
  });
};

export const getFilteredProjects = (
  projects: Project[] | undefined,
  searchQuery: string,
  progressFilter: Task['Progress'][]
) => {
  if (!projects) return [];
  
  console.log('Initial projects:', projects); // Debug log
  
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
  
  console.log('Filtered projects:', filtered); // Debug log
  
  // Sort projects by their sort order
  return filtered.sort((a, b) => {
    // First sort by task list
    const aListId = a.task_list_id ?? -1;
    const bListId = b.task_list_id ?? -1;
    if (aListId !== bListId) {
      return aListId - bListId;
    }
    // Then sort by sort_order within the same list
    return a.sort_order - b.sort_order;
  });
};
