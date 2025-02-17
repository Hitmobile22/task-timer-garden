import { useState, useCallback, useMemo } from 'react';
import { useTaskQueries } from './useTaskQueries';
import { useTaskMutations } from './useTaskMutations';
import { Task } from '@/types/task.types';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";
import { getSortedAndFilteredTasks, getFilteredProjects } from '@/utils/taskViewUtils';
import { DragEndEvent } from '@dnd-kit/core';

export const useTaskView = () => {
  // State
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  const [progressFilter, setProgressFilter] = useState<Task['Progress'][]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'date' | 'list'>('list');
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<number[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [showNewTaskListDialog, setShowNewTaskListDialog] = useState(false);
  const [newTaskListName, setNewTaskListName] = useState("");

  // Queries and Mutations
  const queries = useTaskQueries();
  const mutations = useTaskMutations();

  // Memoized Data
  const filteredTasks = useMemo(() => {
    const filtered = getSortedAndFilteredTasks(
      queries.tasks,
      showArchived,
      searchQuery,
      progressFilter,
      sortBy
    );
    
    if (sortBy === 'list') {
      return queries.taskLists?.map(list => ({
        list,
        projects: getFilteredProjects(queries.projects, searchQuery, progressFilter)
          .filter(p => p.task_list_id === list.id)
          .map(project => ({
            project,
            tasks: filtered.filter(task => 
              task.task_list_id === list.id && 
              task.project_id === project.id
            )
          })),
        tasks: filtered.filter(task => 
          task.task_list_id === list.id && 
          !task.project_id
        )
      })) || [];
    }

    return [{ tasks: filtered }];
  }, [queries.tasks, queries.projects, showArchived, searchQuery, progressFilter, sortBy, queries.taskLists]);

  // Handlers
  const handlers = {
    setEditingTaskId,
    setEditingTaskName,
    setExpandedTasks,
    setProgressFilter,
    setSearchQuery,
    setSortBy,
    setBulkMode,
    setSelectedTasks,
    setShowArchived,
    setShowProjectDialog,
    setShowNewTaskListDialog,
    setNewTaskListName,

    handleToggleExpand: useCallback((taskId: number) => {
      setExpandedTasks(prev => 
        prev.includes(taskId) 
          ? prev.filter(id => id !== taskId)
          : [...prev, taskId]
      );
    }, []),

    handleAddSubtask: useCallback(async (parentTaskId: number) => {
      try {
        const { data, error } = await supabase
          .from('subtasks')
          .insert({
            "Task Name": "New Subtask",
            "Parent Task ID": parentTaskId,
            Progress: "Not started"
          })
          .select()
          .single();

        if (error) throw error;
        setEditingTaskId(data.id);
        setEditingTaskName("New Subtask");
        toast.success('Subtask added');
      } catch (error) {
        console.error('Add subtask error:', error);
        toast.error('Failed to add subtask');
      }
    }, []),

    handleMoveTask: useCallback(async (taskId: number, listId: number, projectId?: number | null) => {
      try {
        const updateData: any = { task_list_id: listId };
        if (projectId !== undefined) {
          updateData.project_id = projectId;
        }

        const { error } = await supabase
          .from('Tasks')
          .update(updateData)
          .eq('id', taskId);

        if (error) throw error;
        toast.success('Task moved successfully');
      } catch (error) {
        toast.error('Failed to move task');
        console.error('Move task error:', error);
      }
    }, []),

    handleDeleteProject: useCallback(async (projectId: number) => {
      try {
        const { data: projectTasks, error: checkError } = await supabase
          .from('Tasks')
          .select('id')
          .eq('project_id', projectId);
        
        if (checkError) throw checkError;
        
        if (projectTasks && projectTasks.length > 0) {
          toast.error('Cannot delete project that contains tasks');
          return;
        }

        const { error } = await supabase
          .from('Projects')
          .delete()
          .eq('id', projectId);

        if (error) throw error;
        toast.success('Project deleted');
      } catch (error) {
        console.error('Delete project error:', error);
        toast.error('Failed to delete project');
      }
    }, []),

    handleDeleteTaskList: useCallback(async (listId: number) => {
      try {
        if (listId === 1) {
          toast.error('Cannot delete default task list');
          return;
        }

        const [tasksResult, projectsResult] = await Promise.all([
          supabase.from('Tasks').select('id').eq('task_list_id', listId),
          supabase.from('Projects').select('id').eq('task_list_id', listId)
        ]);
        
        if (tasksResult.error) throw tasksResult.error;
        if (projectsResult.error) throw projectsResult.error;
        
        if ((tasksResult.data && tasksResult.data.length > 0) || 
            (projectsResult.data && projectsResult.data.length > 0)) {
          toast.error('Cannot delete list that contains tasks or projects');
          return;
        }

        const { error } = await supabase
          .from('TaskLists')
          .delete()
          .eq('id', listId);

        if (error) throw error;
        toast.success('Task list deleted');
      } catch (error) {
        console.error('Delete task list error:', error);
        toast.error('Failed to delete task list');
      }
    }, []),

    handleDragEnd: useCallback(async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = Number(active.id.toString().replace('task-', ''));
      
      let targetListId: number | null = null;
      let targetProjectId: number | null = null;

      if (over.id.toString().startsWith('project-')) {
        const projectId = Number(over.id.toString().replace('project-', ''));
        const project = queries.projects?.find(p => p.id === projectId);
        if (project) {
          targetListId = project.task_list_id;
          targetProjectId = project.id;
        }
      } else if (over.id.toString().startsWith('list-')) {
        targetListId = Number(over.id.toString().replace('list-', ''));
        targetProjectId = null;
      } else {
        const overTaskId = Number(over.id.toString().replace('task-', ''));
        const overTask = queries.tasks?.find(t => t.id === overTaskId);
        if (overTask) {
          targetListId = overTask.task_list_id;
          targetProjectId = overTask.project_id;
        }
      }

      if (targetListId !== null) {
        try {
          await handlers.handleMoveTask(activeId, targetListId, targetProjectId);
          toast.success('Task moved successfully');
        } catch (error) {
          console.error('Move task error:', error);
          toast.error('Failed to move task');
        }
      }
    }, [queries.projects, queries.tasks]),

    handleCreateProject: useCallback(async (project: { name: string; startDate?: Date; dueDate?: Date }) => {
      try {
        const { error } = await supabase
          .from('Projects')
          .insert({
            "Project Name": project.name,
            progress: "Not started",
            task_list_id: 1,
            date_started: project.startDate?.toISOString(),
            date_due: project.dueDate?.toISOString()
          });

        if (error) throw error;
        toast.success('Project created successfully');
        setShowProjectDialog(false);
      } catch (error) {
        console.error('Create project error:', error);
        toast.error('Failed to create project');
      }
    }, []),

    handleBulkProgressUpdate: useCallback((progress: Task['Progress']) => {
      if (selectedTasks.length === 0) return;
      
      Promise.all(
        selectedTasks.map(taskId => 
          mutations.updateProgressMutation.mutateAsync({ 
            taskId,
            progress,
            isSubtask: false
          })
        )
      )
        .then(() => {
          setSelectedTasks([]);
          toast.success('Tasks updated successfully');
        })
        .catch((error) => {
          toast.error('Failed to update tasks');
          console.error('Bulk update error:', error);
        });
    }, [selectedTasks, mutations.updateProgressMutation]),

    handleBulkSelect: useCallback((taskId: number, selected: boolean) => {
      setSelectedTasks(prev => 
        selected 
          ? [...prev, taskId]
          : prev.filter(id => id !== taskId)
      );
    }, []),
  };

  return {
    state: {
      editingTaskId,
      editingTaskName,
      expandedTasks,
      progressFilter,
      searchQuery,
      sortBy,
      bulkMode,
      selectedTasks,
      showArchived,
      showProjectDialog,
      showNewTaskListDialog,
      newTaskListName,
      filteredTasks
    },
    handlers,
    queries,
    mutations
  };
};
