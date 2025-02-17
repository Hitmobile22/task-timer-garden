
import { Task, Project } from '@/types/task.types';
import { TASK_LIST_COLORS } from '@/constants/taskColors';

export const getSortedAndFilteredTasks = (
  tasks: Task[] | undefined,
  showArchived: boolean,
  searchQuery: string,
  progressFilter: Task['Progress'][],
  sortBy: 'date' | 'list'
) => {
  if (!tasks) return [];
  
  console.log('Initial tasks:', tasks);
  
  let filteredTasks = [...tasks];

  // Filter archived tasks
  filteredTasks = filteredTasks.filter(task => showArchived ? true : !task.archived);
  
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

  // Sort by list, project, and order
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
  
  // Sort projects by task list and then by project_order
  return filtered.sort((a, b) => {
    const aListId = a.task_list_id ?? -1;
    const bListId = b.task_list_id ?? -1;
    if (aListId !== bListId) {
      return aListId - bListId;
    }
    return (a.project_order ?? 0) - (b.project_order ?? 0);
  });
};

export const getTaskListColor = (listName: string) => {
  return TASK_LIST_COLORS[listName as keyof typeof TASK_LIST_COLORS] || TASK_LIST_COLORS['Default'];
};
