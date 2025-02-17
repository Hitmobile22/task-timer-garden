import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MenuBar } from "@/components/MenuBar";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, Subtask, SortField, SortOrder, Project } from '@/types/task.types';
import { TaskListComponent } from '@/components/task/TaskList';
import { TaskFilters } from '@/components/task/TaskFilters';
import { GoogleCalendarIntegration } from '@/components/task/GoogleCalendarIntegration';
import { ProjectDialog } from '@/components/task/ProjectDialog';
import { generateRandomColor } from '@/utils/taskUtils';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Filter, ListFilter, Plus, PencilIcon, Folders } from "lucide-react";
import { format } from 'date-fns';
import { DEFAULT_LIST_COLOR, TASK_LIST_COLORS } from '@/constants/taskColors';

export function TaskView() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingTaskId, setEditingTaskId] = React.useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = React.useState("");
  const [expandedTasks, setExpandedTasks] = React.useState<number[]>([]);
  const [sortField] = React.useState<SortField>("Task Name");
  const [sortOrder] = React.useState<SortOrder>("asc");
  const [progressFilter, setProgressFilter] = React.useState<Task['Progress'][]>(["Not started", "In progress"]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [newTaskListName, setNewTaskListName] = React.useState("");
  const [showNewTaskListDialog, setShowNewTaskListDialog] = React.useState(false);
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [sortBy, setSortBy] = useState<'date' | 'list'>('list');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Projects')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Task[];
    },
  });

  const { data: subtasks, isLoading: subtasksLoading } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      if (!tasks || tasks.length === 0) return [];
      
      const taskIds = tasks.map(task => task.id);
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .in('Parent Task ID', taskIds);
      
      if (error) throw error;
      return data as Subtask[];
    },
    enabled: !!tasks?.length,
  });

  const { data: taskLists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('TaskLists')
        .select('*')
        .order('order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const [activeType, activeItemId] = activeId.toString().split('-');
    const [overType, overItemId] = overId.toString().split('-');

    if (activeType === 'task') {
      if (overType === 'list') {
        updateTaskListMutation.mutate({ 
          listId: parseInt(overItemId), 
          name: activeItemId 
        });
      } else if (overType === 'project') {
        updateTaskProjectMutation.mutate({ 
          taskId: parseInt(activeItemId), 
          projectId: parseInt(overItemId) 
        });
      }
    }
  };

  const getSortedAndFilteredTasks = React.useCallback((tasks: Task[] | undefined) => {
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
  }, [progressFilter, searchQuery, sortBy, showArchived]);

  const filteredProjects = React.useMemo(() => {
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
  }, [projects, searchQuery, progressFilter]);

  const organizedTasks = React.useMemo(() => {
    if (!tasks || !taskLists) return [];
    
    const filteredTasks = getSortedAndFilteredTasks(tasks);
    const result = [];

    taskLists.forEach(list => {
      const listProjects = filteredProjects?.filter(project => project.task_list_id === list.id) || [];
      const projectComponents = listProjects.map(project => {
        const projectTasks = filteredTasks.filter(task => task.project_id === project.id);
        return {
          type: 'project',
          id: `project-${project.id}`,
          name: project["Project Name"],
          progress: project.progress,
          tasks: projectTasks,
          parentList: list
        };
      });

      const listTasks = filteredTasks.filter(
        task => task.task_list_id === list.id && !task.project_id
      );

      if (projectComponents.length > 0 || listTasks.length > 0) {
        result.push({
          type: 'list',
          id: `list-${list.id}`,
          name: list.name,
          color: list.color || DEFAULT_LIST_COLOR,
          projects: projectComponents,
          tasks: listTasks
        });
      }
    });

    return result;
  }, [tasks, taskLists, filteredProjects, getSortedAndFilteredTasks]);

  const isLoading = tasksLoading || subtasksLoading || projectsLoading;

  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const { error } = await supabase
        .from('Tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete task');
      console.error('Delete error:', error);
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ taskId, progress, isSubtask = false }: { taskId: number; progress: Task['Progress']; isSubtask?: boolean }) => {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ Progress: progress })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Progress updated');
    },
    onError: (error) => {
      toast.error('Failed to update progress');
      console.error('Update error:', error);
    },
  });

  const updateTaskNameMutation = useMutation({
    mutationFn: async ({ taskId, taskName, isSubtask = false }: { taskId: number; taskName: string; isSubtask?: boolean }) => {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ "Task Name": taskName })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      toast.success('Task name updated');
      setEditingTaskId(null);
    },
    onError: (error) => {
      toast.error('Failed to update task name');
      console.error('Update error:', error);
    },
  });

  const createTaskListMutation = useMutation({
    mutationFn: async (name: string) => {
      const color = generateRandomColor();
      const { error } = await supabase
        .from('TaskLists')
        .insert([{ name, color }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      setNewTaskListName("");
      setShowNewTaskListDialog(false);
      toast.success('Task list created');
    },
    onError: (error) => {
      toast.error('Failed to create task list');
      console.error('Create error:', error);
    },
  });

  const deleteTaskListMutation = useMutation({
    mutationFn: async (listId: number) => {
      const { error } = await supabase
        .from('TaskLists')
        .delete()
        .eq('id', listId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      toast.success('Task list deleted');
    },
  });

  const updateTaskListMutation = useMutation({
    mutationFn: async ({ listId, name }: { listId: number; name: string }) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ task_list_id: listId })
        .eq('id', parseInt(name));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task moved to new list');
    },
    onError: (error) => {
      toast.error('Failed to move task');
      console.error('Update error:', error);
    },
  });

  const updateTaskTimelineMutation = useMutation({
    mutationFn: async ({ taskId, start, end }: { taskId: number; start: Date; end: Date }) => {
      const { error } = await supabase
        .from('Tasks')
        .update({
          date_started: start.toISOString(),
          date_due: end.toISOString()
        })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task timeline updated');
    },
    onError: (error) => {
      toast.error('Failed to update task timeline');
      console.error('Update error:', error);
    },
  });

  const updateListNameMutation = useMutation({
    mutationFn: async ({ listId, name }: { listId: number; name: string }) => {
      const { error } = await supabase
        .from('TaskLists')
        .update({ name })
        .eq('id', listId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      setEditingListId(null);
      setEditingListName("");
      toast.success('List name updated');
    },
    onError: (error) => {
      toast.error('Failed to update list name');
      console.error('Update error:', error);
    },
  });

  const archiveTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      const { data: task, error: fetchError } = await supabase
        .from('Tasks')
        .select('archived')
        .eq('id', taskId)
        .single();
      
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('Tasks')
        .update({ archived: !task?.archived })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task archive status updated');
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (project: { name: string; startDate?: Date; dueDate?: Date }) => {
      const { error } = await supabase
        .from('Projects')
        .insert([{
          "Project Name": project.name,
          progress: "Not started",
          date_started: project.startDate?.toISOString(),
          date_due: project.dueDate?.toISOString(),
          sort_order: (projects?.length || 0) + 1
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create project');
      console.error('Create project error:', error);
    },
  });

  const updateTaskProjectMutation = useMutation({
    mutationFn: async ({ taskId, projectId }: { taskId: number; projectId: number | null }) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ project_id: projectId })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task moved successfully');
    },
  });

  const handleEditStart = (task: Task | Subtask) => {
    setEditingTaskId(task.id);
    setEditingTaskName(task["Task Name"]);
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditingTaskName("");
  };

  const handleEditSave = (taskId: number, isSubtask = false) => {
    if (editingTaskName.trim()) {
      updateTaskNameMutation.mutate({ taskId, taskName: editingTaskName, isSubtask });
    } else {
      toast.error('Task name cannot be empty');
    }
  };

  const toggleTaskExpansion = (taskId: number) => {
    setExpandedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'MMM d, h:mm a');
  };

  const handleProgressFilterChange = (progress: Task['Progress']) => {
    setProgressFilter(prev => {
      if (prev.includes(progress)) {
        return prev.filter(p => p !== progress);
      }
      return [...prev, progress];
    });
  };

  const handleAddSubtask = async (parentTaskId: number) => {
    const { error } = await supabase
      .from('subtasks')
      .insert([{
        "Task Name": "New Subtask",
        "Parent Task ID": parentTaskId,
        Progress: "Not started"
      }]);
    
    if (error) {
      toast.error('Failed to add subtask');
      return;
    }
    
    queryClient.invalidateQueries({ queryKey: ['subtasks'] });
    toast.success('Subtask added');
  };

  const handleArchiveTask = async (taskId: number) => {
    try {
      await archiveTaskMutation.mutateAsync(taskId);
    } catch (error) {
      console.error('Error toggling archive status:', error);
      toast.error('Failed to update archive status');
    }
  };

  const handleBulkProgressUpdate = async (progress: Task['Progress']) => {
    if (selectedTasks.length === 0) return;
    
    try {
      for (const taskId of selectedTasks) {
        await updateProgressMutation.mutateAsync({ 
          taskId,
          progress,
          isSubtask: false
        });
      }
      
      setSelectedTasks([]);
      toast.success('Tasks updated successfully');
    } catch (error) {
      toast.error('Failed to update tasks');
      console.error('Bulk update error:', error);
    }
  };

  const handleUpdateProgress = useCallback((taskId: number, progress: Task['Progress'], isSubtask?: boolean) => {
    updateProgressMutation.mutate({ taskId, progress, isSubtask });
  }, [updateProgressMutation]);

  const handleMoveTask = useCallback((taskId: number, listId: number) => {
    updateTaskListMutation.mutate({ listId, name: taskId.toString() });
  }, [updateTaskListMutation]);

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-7xl">
        <MenuBar />
      </div>
      
      <main className="container mx-auto max-w-7xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Task Manager</h1>
          <p className="text-white/80">View and manage your tasks</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <TaskFilters
              searchQuery={searchQuery}
              progressFilter={progressFilter}
              sortBy={sortBy}
              showNewTaskListDialog={showNewTaskListDialog}
              newTaskListName={newTaskListName}
              onSearchChange={setSearchQuery}
              onProgressFilterChange={handleProgressFilterChange}
              onSortByChange={setSortBy}
              onNewTaskListDialogChange={setShowNewTaskListDialog}
              onNewTaskListNameChange={setNewTaskListName}
              onCreateTaskList={() => createTaskListMutation.mutate(newTaskListName)}
            />
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => setShowProjectDialog(true)}
                className="flex items-center gap-2"
              >
                <Folders className="w-4 h-4" />
                New Project
              </Button>
              <Button
                variant="outline"
                onClick={() => setBulkMode(!bulkMode)}
                className={bulkMode ? "bg-primary text-white" : ""}
              >
                <PencilIcon className="w-4 h-4 mr-2" />
                Bulk Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowArchived(!showArchived)}
              >
                <ListFilter className="w-4 h-4 mr-2" />
                {showArchived ? "Hide Archived" : "Show Archived"}
              </Button>
              <GoogleCalendarIntegration />
            </div>
          </div>

          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="space-y-6">
              {organizedTasks.map(list => (
                <div 
                  key={list.id}
                  className="space-y-4"
                >
                  <div 
                    className="p-4 rounded-lg"
                    style={{
                      background: list.color || DEFAULT_LIST_COLOR,
                    }}
                  >
                    <h2 className="text-xl font-bold text-white mb-4">{list.name}</h2>
                    
                    {list.projects.length > 0 && (
                      <div className="space-y-4 mb-4">
                        {list.projects.map(project => (
                          <div 
                            key={project.id}
                            className="p-4 rounded-lg bg-white/90 backdrop-blur-sm"
                          >
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                              <span>{project.name}</span>
                              <span className="text-sm font-normal text-gray-500">
                                ({project.progress})
                              </span>
                            </h3>
                            {project.tasks.length > 0 ? (
                              <TaskListComponent
                                tasks={project.tasks}
                                subtasks={subtasks}
                                expandedTasks={expandedTasks}
                                editingTaskId={editingTaskId}
                                editingTaskName={editingTaskName}
                                taskLists={taskLists || []}
                                bulkMode={bulkMode}
                                selectedTasks={selectedTasks}
                                showArchived={showArchived}
                                onToggleExpand={toggleTaskExpansion}
                                onEditStart={handleEditStart}
                                onEditCancel={handleEditCancel}
                                onEditSave={handleEditSave}
                                onEditNameChange={setEditingTaskName}
                                onUpdateProgress={handleUpdateProgress}
                                onMoveTask={handleMoveTask}
                                onDeleteTask={deleteMutation.mutate}
                                onArchiveTask={handleArchiveTask}
                                onAddSubtask={handleAddSubtask}
                                onTimelineEdit={(taskId, start, end) => {
                                  updateTaskTimelineMutation.mutate({ taskId, start, end });
                                }}
                                onBulkSelect={(taskId, selected) => {
                                  setSelectedTasks(prev => 
                                    selected 
                                      ? [...prev, taskId]
                                      : prev.filter(id => id !== taskId)
                                  );
                                }}
                                onBulkProgressUpdate={handleBulkProgressUpdate}
                              />
                            ) : (
                              <p className="text-gray-500 italic">No tasks in this project yet</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {list.tasks.length > 0 && (
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4">
                        <TaskListComponent
                          tasks={list.tasks}
                          subtasks={subtasks}
                          expandedTasks={expandedTasks}
                          editingTaskId={editingTaskId}
                          editingTaskName={editingTaskName}
                          taskLists={taskLists || []}
                          bulkMode={bulkMode}
                          selectedTasks={selectedTasks}
                          showArchived={showArchived}
                          onToggleExpand={toggleTaskExpansion}
                          onEditStart={handleEditStart}
                          onEditCancel={handleEditCancel}
                          onEditSave={handleEditSave}
                          onEditNameChange={setEditingTaskName}
                          onUpdateProgress={handleUpdateProgress}
                          onMoveTask={handleMoveTask}
                          onDeleteTask={deleteMutation.mutate}
                          onArchiveTask={handleArchiveTask}
                          onAddSubtask={handleAddSubtask}
                          onTimelineEdit={(taskId, start, end) => {
                            updateTaskTimelineMutation.mutate({ taskId, start, end });
                          }}
                          onBulkSelect={(taskId, selected) => {
                            setSelectedTasks(prev => 
                              selected 
                                ? [...prev, taskId]
                                : prev.filter(id => id !== taskId)
                            );
                          }}
                          onBulkProgressUpdate={handleBulkProgressUpdate}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DndContext>
        </div>
      </main>

      <ProjectDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onCreateProject={createProjectMutation.mutate}
      />
    </div>
  );
}

export default TaskView;
