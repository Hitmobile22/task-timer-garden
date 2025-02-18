import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MenuBar } from "@/components/MenuBar";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, Subtask, SortField, SortOrder } from '@/types/task.types';
import { TaskListComponent } from '@/components/task/TaskList';
import { TaskFilters } from '@/components/task/TaskFilters';
import { GoogleCalendarIntegration } from '@/components/task/GoogleCalendarIntegration';
import { generateRandomColor } from '@/utils/taskUtils';
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpDown, Filter, ListFilter, Plus, Trash2, PencilIcon, Check, X, ChevronRight, ChevronDown, Clock } from "lucide-react";
import { format } from 'date-fns';
import { DEFAULT_LIST_COLOR } from '@/constants/taskColors';
import { ProjectModal } from '@/components/project/ProjectModal';
import { Edit2, Trash2 } from 'lucide-react';

export function TaskView() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingTaskId, setEditingTaskId] = React.useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = React.useState("");
  const [expandedTasks, setExpandedTasks] = React.useState<number[]>([]);
  const [sortField] = React.useState<SortField>("Task Name");
  const [sortOrder] = React.useState<SortOrder>("asc");
  const [progressFilter, setProgressFilter] = React.useState<Task['Progress'] | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [newTaskListName, setNewTaskListName] = React.useState("");
  const [showNewTaskListDialog, setShowNewTaskListDialog] = React.useState(false);
  const [editingListId, setEditingListId] = useState<number | null>(null);
  const [editingListName, setEditingListName] = useState("");
  const [sortBy, setSortBy] = useState<'date' | 'list' | 'project'>('list');
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = React.useState<any>(null);

  const { data: taskLists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('TaskLists')
        .select('*')
        .order('order', { ascending: true });
      
      if (error) throw error;
      console.log('TaskView: Available task lists:', data);
      return data;
    },
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('date_started', { ascending: false });
      
      if (error) throw error;
      console.log('TaskView: Current tasks with their list IDs:', 
        data?.map(t => ({ id: t.id, name: t["Task Name"], list_id: t.task_list_id }))
      );
      return data as Task[];
    },
  });

  const { data: subtasks, isLoading: subtasksLoading } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Subtask[];
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Projects')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

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
    mutationFn: async ({ taskId, listId }: { taskId: number; listId: number }) => {
      console.log('TaskView: updateTaskListMutation called with:', { taskId, listId });
      console.log('TaskView: Available task lists at time of mutation:', taskLists);
      
      const { data, error } = await supabase
        .from('Tasks')
        .update({ task_list_id: listId })
        .eq('id', taskId)
        .select();
      
      if (error) {
        console.error('TaskView: Update failed:', error);
        throw error;
      }
      
      console.log('TaskView: Update successful, updated task:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('TaskView: Mutation succeeded, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task moved to new list');
    },
    onError: (error) => {
      console.error('TaskView: Mutation failed:', error);
      toast.error('Failed to move task');
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

  const createProjectMutation = useMutation({
    mutationFn: async (projectData: any) => {
      const { name, selectedTasks, startDate, dueDate, status, taskListId } = projectData;
      
      const { data: newProject, error: projectError } = await supabase
        .from('Projects')
        .insert([{
          "Project Name": name,
          progress: status || "Not started",
          date_started: startDate?.toISOString(),
          date_due: dueDate?.toISOString(),
          task_list_id: taskListId,
          sort_order: 0
        }])
        .select()
        .single();
      
      if (projectError) throw projectError;
      
      return newProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowProjectModal(false);
      toast.success('Project created successfully');
    },
    onError: (error) => {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (projectData: any) => {
      const { data: updatedProject, error: projectError } = await supabase
        .from('Projects')
        .update({
          "Project Name": projectData.name,
          progress: projectData.status,
          date_started: projectData.startDate,
          date_due: projectData.dueDate,
          task_list_id: projectData.taskListId,
        })
        .eq('id', projectData.id)
        .select()
        .single();

      if (projectError) throw projectError;

      const { error: tasksError } = await supabase
        .from('Tasks')
        .update({ project_id: null })
        .eq('project_id', projectData.id);

      if (tasksError) throw tasksError;

      if (projectData.selectedTasks.length > 0) {
        const { error: assignError } = await supabase
          .from('Tasks')
          .update({ project_id: projectData.id })
          .in('id', projectData.selectedTasks);

        if (assignError) throw assignError;
      }

      return updatedProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project updated successfully');
      setEditingProject(null);
    },
    onError: (error) => {
      console.error('Failed to update project:', error);
      toast.error('Failed to update project');
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const { error: tasksError } = await supabase
        .from('Tasks')
        .update({ project_id: null })
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;

      const { error: projectError } = await supabase
        .from('Projects')
        .delete()
        .eq('id', projectId);

      if (projectError) throw projectError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete project:', error);
      toast.error('Failed to delete project');
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

  const isLoading = tasksLoading || subtasksLoading;

  const getSortedAndFilteredTasks = React.useCallback((tasks: Task[] | undefined) => {
    if (!tasks) return [];
    
    let filteredTasks = [...tasks];
    
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filteredTasks = filteredTasks.filter(task => 
        task["Task Name"]?.toLowerCase().includes(searchLower)
      );
    }
    
    if (progressFilter !== "all") {
      filteredTasks = filteredTasks.filter(task => task.Progress === progressFilter);
    }
    
    switch (sortBy) {
      case 'date':
        return filteredTasks.sort((a, b) => {
          const aDate = a.date_started ? new Date(a.date_started) : new Date(0);
          const bDate = b.date_started ? new Date(b.date_started) : new Date(0);
          return aDate.getTime() - bDate.getTime();
        });
      case 'list':
        return filteredTasks.sort((a, b) => {
          const aListId = a.task_list_id || 0;
          const bListId = b.task_list_id || 0;
          return aListId - bListId;
        });
      case 'project':
        return filteredTasks.sort((a, b) => {
          const aProjectId = a.project_id || 0;
          const bProjectId = b.project_id || 0;
          return aProjectId - bProjectId;
        });
      default:
        return filteredTasks;
    }
  }, [progressFilter, searchQuery, sortBy]);

  const filteredAndGroupedTasks = React.useMemo(() => {
    if (!tasks || (!taskLists && sortBy === 'list') || (!projects && sortBy === 'project')) {
      console.log('TaskView: No tasks or required grouping data available');
      return new Map();
    }
    
    const filteredTasks = getSortedAndFilteredTasks(tasks);
    const grouped = new Map();
    
    if (sortBy === 'list') {
      taskLists?.forEach(list => {
        const listTasks = filteredTasks.filter(task => task.task_list_id === list.id);
        
        if (listTasks.length > 0) {
          grouped.set(list.id, {
            list,
            tasks: listTasks
          });
        }
      });
    } else if (sortBy === 'project') {
      taskLists?.forEach(list => {
        const listTasks = filteredTasks.filter(task => task.task_list_id === list.id);
        const listProjects = projects?.filter(p => p.task_list_id === list.id) || [];
        
        if (listProjects.length > 0 || listTasks.length > 0) {
          grouped.set(list.id, {
            list,
            projects: listProjects,
            tasks: listTasks
          });
        }
      });
    } else {
      grouped.set('all', {
        tasks: filteredTasks
      });
    }
    
    return grouped;
  }, [tasks, taskLists, projects, getSortedAndFilteredTasks, sortBy]);

  const handleMoveTask = (taskId: number, listId: number) => {
    console.log('TaskView: handleMoveTask called with:', { taskId, listId });
    console.log('TaskView: Current taskLists:', taskLists);
    console.log('TaskView: Current tasks:', tasks);
    updateTaskListMutation.mutate({ taskId, listId });
  };

  const handleProjectSubmit = (projectData: any) => {
    if (projectData.id) {
      updateProjectMutation.mutate(projectData);
    } else {
      createProjectMutation.mutate(projectData);
    }
    setShowProjectModal(false);
  };

  return (
    <div className="min-h-screen p-6 space-y-8 animate-fadeIn" style={{
      background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
    }}>
      <div className="container mx-auto max-w-4xl">
        <MenuBar />
      </div>
      
      <main className="container mx-auto max-w-4xl space-y-8">
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
              showProjectModal={showProjectModal}
              newTaskListName={newTaskListName}
              onSearchChange={setSearchQuery}
              onProgressFilterChange={setProgressFilter}
              onSortByChange={setSortBy}
              onNewTaskListDialogChange={setShowNewTaskListDialog}
              onProjectModalChange={setShowProjectModal}
              onNewTaskListNameChange={setNewTaskListName}
              onCreateTaskList={() => createTaskListMutation.mutate(newTaskListName)}
            />
            <GoogleCalendarIntegration />
          </div>

          <DndContext collisionDetection={closestCenter}>
            {Array.from(filteredAndGroupedTasks.entries()).map(([listId, { list, tasks: listTasks, projects: listProjects }]) => (
              <div key={listId} className="mb-8">
                <div 
                  className="mb-4 p-2 rounded flex items-center justify-between"
                  style={{
                    background: list?.color || DEFAULT_LIST_COLOR,
                    color: 'white'
                  }}
                >
                  <h3 className="text-lg font-semibold text-white">{list?.name}</h3>
                </div>
                
                <div className="space-y-4">
                  {listProjects?.map(project => (
                    <div key={project.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          {expandedTasks.includes(project.id) ? (
                            <ChevronDown className="h-4 w-4 cursor-pointer" onClick={() => toggleTaskExpansion(project.id)} />
                          ) : (
                            <ChevronRight className="h-4 w-4 cursor-pointer" onClick={() => toggleTaskExpansion(project.id)} />
                          )}
                          <span className="font-medium">{project["Project Name"]}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const projectTasks = listTasks?.filter(t => t.project_id === project.id);
                              setEditingProject({
                                id: project.id,
                                name: project["Project Name"],
                                status: project.progress,
                                startDate: project.date_started ? new Date(project.date_started) : undefined,
                                dueDate: project.date_due ? new Date(project.date_due) : undefined,
                                taskListId: project.task_list_id,
                                selectedTasks: projectTasks?.map(t => t.id) || [],
                              });
                              setShowProjectModal(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteProjectMutation.mutate(project.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {expandedTasks.includes(project.id) && (
                        <div className="pl-6">
                          <SortableContext items={listTasks?.filter(t => t.project_id === project.id).map(t => t.id) || []} strategy={verticalListSortingStrategy}>
                            <TaskListComponent
                              tasks={listTasks?.filter(t => t.project_id === project.id) || []}
                              subtasks={subtasks}
                              expandedTasks={expandedTasks}
                              editingTaskId={editingTaskId}
                              editingTaskName={editingTaskName}
                              taskLists={taskLists}
                              onToggleExpand={toggleTaskExpansion}
                              onEditStart={handleEditStart}
                              onEditCancel={handleEditCancel}
                              onEditSave={handleEditSave}
                              onEditNameChange={setEditingTaskName}
                              onUpdateProgress={(taskId, progress, isSubtask) => 
                                updateProgressMutation.mutate({ taskId, progress, isSubtask })
                              }
                              onMoveTask={handleMoveTask}
                              onDeleteTask={(taskId) => deleteMutation.mutate(taskId)}
                              onTimelineEdit={(taskId, start, end) => {
                                updateTaskTimelineMutation.mutate({ 
                                  taskId, 
                                  start: new Date(start), 
                                  end: new Date(end) 
                                });
                              }}
                            />
                          </SortableContext>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {listTasks?.filter(t => !t.project_id).length > 0 && (
                    <SortableContext items={listTasks?.filter(t => !t.project_id).map(t => t.id) || []} strategy={verticalListSortingStrategy}>
                      <TaskListComponent
                        tasks={listTasks?.filter(t => !t.project_id) || []}
                        subtasks={subtasks}
                        expandedTasks={expandedTasks}
                        editingTaskId={editingTaskId}
                        editingTaskName={editingTaskName}
                        taskLists={taskLists}
                        onToggleExpand={toggleTaskExpansion}
                        onEditStart={handleEditStart}
                        onEditCancel={handleEditCancel}
                        onEditSave={handleEditSave}
                        onEditNameChange={setEditingTaskName}
                        onUpdateProgress={(taskId, progress, isSubtask) => 
                          updateProgressMutation.mutate({ taskId, progress, isSubtask })
                        }
                        onMoveTask={handleMoveTask}
                        onDeleteTask={(taskId) => deleteMutation.mutate(taskId)}
                        onTimelineEdit={(taskId, start, end) => {
                          updateTaskTimelineMutation.mutate({ 
                            taskId, 
                            start: new Date(start), 
                            end: new Date(end) 
                          });
                        }}
                      />
                    </SortableContext>
                  )}
                </div>
              </div>
            ))}
          </DndContext>
        </div>
      </main>

      <ProjectModal
        open={showProjectModal}
        onClose={() => {
          setShowProjectModal(false);
          setEditingProject(null);
        }}
        onSubmit={handleProjectSubmit}
        taskLists={taskLists || []}
        availableTasks={tasks || []}
        initialData={editingProject}
      />
    </div>
  );
}

export default TaskView;
