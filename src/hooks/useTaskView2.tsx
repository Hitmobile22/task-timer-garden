
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Task } from '@/types/task.types';
import { toast } from 'sonner';
import { DragEndEvent } from '@dnd-kit/core';

export const useTaskView2 = () => {
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
  const queryClient = useQueryClient();

  // Queries
  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      console.log('Fetching tasks...');
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('position', { ascending: true });
      
      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }
      console.log('Tasks fetched:', data);
      return data;
    },
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      console.log('Fetching projects...');
      const { data, error } = await supabase
        .from('Projects')
        .select('*')
        .order('position', { ascending: true });
      
      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }
      console.log('Projects fetched:', data);
      return data;
    },
  });

  const { data: taskLists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      console.log('Fetching task lists...');
      const { data, error } = await supabase
        .from('TaskLists')
        .select('*')
        .order('position', { ascending: true });
      
      if (error) {
        console.error('Error fetching task lists:', error);
        throw error;
      }
      console.log('Task lists fetched:', data);
      return data;
    },
  });

  const { data: subtasks, isLoading: subtasksLoading } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      if (!tasks || tasks.length === 0) return [];
      
      console.log('Fetching subtasks...');
      const taskIds = tasks.map(task => task.id);
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .in('Parent Task ID', taskIds);
      
      if (error) {
        console.error('Error fetching subtasks:', error);
        throw error;
      }
      console.log('Subtasks fetched:', data);
      return data;
    },
    enabled: !!tasks?.length,
  });

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

    handleToggleExpand: useCallback((taskId: number) => {
      setExpandedTasks(prev => 
        prev.includes(taskId) 
          ? prev.filter(id => id !== taskId)
          : [...prev, taskId]
      );
    }, []),

    handleDragEnd: useCallback(async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      try {
        const activeId = active.id.toString().replace(/^(task|project|list)-/, '');
        const overId = over.id.toString().replace(/^(task|project|list)-/, '');
        
        const type = active.id.toString().split('-')[0];
        const table = type === 'task' ? 'Tasks' : type === 'project' ? 'Projects' : 'TaskLists';
        
        const items = type === 'task' ? tasks : type === 'project' ? projects : taskLists;
        if (!items) return;

        const activeItem = items.find(item => item.id.toString() === activeId);
        const overItem = items.find(item => item.id.toString() === overId);
        if (!activeItem || !overItem) return;

        const newPosition = calculateNewPosition(activeItem.position, overItem.position, items);

        const { error } = await supabase
          .from(table)
          .update({ position: newPosition })
          .eq('id', activeId);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: [table.toLowerCase()] });
        toast.success('Item position updated');
      } catch (error) {
        console.error('Error updating position:', error);
        toast.error('Failed to update position');
      }
    }, [tasks, projects, taskLists, queryClient]),

    handleCreateProject: useCallback(async (project: { 
      name: string; 
      startDate?: Date; 
      dueDate?: Date 
    }) => {
      try {
        const { error } = await supabase
          .from('Projects')
          .insert({
            "Project Name": project.name,
            progress: "Not started",
            task_list_id: 1,
            date_started: project.startDate?.toISOString(),
            date_due: project.dueDate?.toISOString(),
            position: (projects?.length || 0) * 1000
          });

        if (error) throw error;
        
        queryClient.invalidateQueries({ queryKey: ['projects'] });
        setShowProjectDialog(false);
        toast.success('Project created successfully');
      } catch (error) {
        console.error('Error creating project:', error);
        toast.error('Failed to create project');
      }
    }, [projects, queryClient]),
  };

  const calculateNewPosition = (activePos: number | null, overPos: number | null, items: any[]) => {
    const positions = items
      .map(item => item.position)
      .filter(pos => pos !== null)
      .sort((a, b) => a - b);

    if (positions.length === 0) return 1000;
    
    if (!activePos || !overPos) {
      // If either position is null, place at end
      return (positions[positions.length - 1] || 0) + 1000;
    }

    if (activePos < overPos) {
      // Moving down
      const nextPos = positions[positions.indexOf(overPos) + 1];
      return nextPos ? (overPos + nextPos) / 2 : overPos + 1000;
    } else {
      // Moving up
      const prevPos = positions[positions.indexOf(overPos) - 1];
      return prevPos ? (prevPos + overPos) / 2 : overPos / 2;
    }
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
    },
    handlers,
    queries: {
      tasks,
      projects,
      taskLists,
      subtasks,
      isLoading: tasksLoading || projectsLoading || subtasksLoading
    },
    mutations: {}
  };
};
