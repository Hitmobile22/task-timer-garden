import React, { useState, useEffect, useMemo } from 'react';
import { TaskForm } from './TaskForm';
import { TaskListComponent } from './task/TaskList';
import { TaskEditModal } from './task/TaskEditModal';
import { Task, Subtask, SortField, SortOrder } from '@/types/task.types';
import { TaskFilters } from './task/TaskFilters';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';

interface TaskListProps {
  tasks: Task[];
  subtasks?: Subtask[];
  onTaskStart: (taskId: number) => void;
  taskLists?: any[];
  activeTaskId?: number;
  onTaskDurationChange?: (taskId: number, newDurationMinutes: number) => void; // Add this prop
}

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  subtasks = [], 
  onTaskStart, 
  taskLists = [],
  activeTaskId,
  onTaskDurationChange 
}) => {
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('date_started');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taskListFilter, setTaskListFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [editModalTask, setEditModalTask] = useState<Task | null>(null);
  const [newTaskListName, setNewTaskListName] = useState<string>('');
  
  const queryClient = useQueryClient();

  const { data: allSubtasks } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .order('id', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const updateTaskProgress = useMutation({
    mutationFn: async ({ taskId, progress, isSubtask = false }: { taskId: number; progress: Task['Progress']; isSubtask?: boolean }) => {
      const table = isSubtask ? 'subtasks' : 'Tasks';
      const { error } = await supabase
        .from(table)
        .update({ Progress: progress })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task updated successfully');
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast.error('Failed to update task');
    }
  });

  const moveTask = useMutation({
    mutationFn: async ({ taskId, listId }: { taskId: number; listId: number }) => {
      console.log('TaskList: Moving task', taskId, 'to list', listId);
      const { error } = await supabase
        .from('Tasks')
        .update({ task_list_id: listId })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task moved successfully');
    },
    onError: (error) => {
      console.error('Error moving task:', error);
      toast.error('Failed to move task');
    }
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: number) => {
      const { error } = await supabase
        .from('Tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting task:', error);
      toast.error('Failed to delete task');
    }
  });

  const createTaskList = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('TaskLists')
        .insert([{ name }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-lists'] });
      setNewTaskListName('');
      toast.success('Task list created successfully');
    },
    onError: (error) => {
      console.error('Error creating task list:', error);
      toast.error('Failed to create task list');
    }
  });

  const unarchiveTask = useMutation({
    mutationFn: async (taskId: number) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ archived: false })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
      toast.success('Task unarchived successfully');
    },
    onError: (error) => {
      console.error('Error unarchiving task:', error);
      toast.error('Failed to unarchive task');
    }
  });

  const handleToggleExpand = (taskId: number) => {
    setExpandedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleEditStart = (task: Task | Subtask) => {
    setEditingTaskId(task.id);
    setEditingTaskName(task["Task Name"]);
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const handleEditSave = (taskId: number, isSubtask = false) => {
    const table = isSubtask ? 'subtasks' : 'Tasks';
    
    supabase
      .from(table)
      .update({ 'Task Name': editingTaskName })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) {
          console.error('Error updating task name:', error);
          toast.error('Failed to update task name');
        } else {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['subtasks'] });
          queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
          toast.success('Task name updated');
          setEditingTaskId(null);
          setEditingTaskName('');
        }
      });
  };

  const handleEditNameChange = (value: string) => {
    setEditingTaskName(value);
  };

  const handleUpdateProgress = (taskId: number, progress: Task['Progress'], isSubtask = false) => {
    updateTaskProgress.mutate({ taskId, progress, isSubtask });
  };

  const handleMoveTask = (taskId: number, listId: number) => {
    console.log('TaskList: handleMoveTask called with:', { taskId, listId });
    moveTask.mutate({ taskId, listId });
  };

  const handleDeleteTask = (taskId: number) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      deleteTask.mutate(taskId);
    }
  };

  const handleTimelineEdit = (taskId: number, start: Date, end: Date) => {
    supabase
      .from('Tasks')
      .update({
        date_started: start.toISOString(),
        date_due: end.toISOString()
      })
      .eq('id', taskId)
      .then(({ error }) => {
        if (error) {
          console.error('Error updating task timeline:', error);
          toast.error('Failed to update task timeline');
        } else {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          queryClient.invalidateQueries({ queryKey: ['active-tasks'] });
          toast.success('Task timeline updated');
        }
      });
  };

  const handleCreateTaskList = () => {
    if (newTaskListName.trim()) {
      createTaskList.mutate(newTaskListName.trim());
    }
  };

  const handleUnarchiveTask = (taskId: number) => {
    unarchiveTask.mutate(taskId);
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => {
        // Search filter
        if (searchTerm && !task["Task Name"]?.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
        
        // Status filter
        if (statusFilter !== 'all' && task.Progress !== statusFilter) {
          return false;
        }
        
        // Task list filter
        if (taskListFilter !== 'all' && task.task_list_id?.toString() !== taskListFilter) {
          return false;
        }
        
        // Archived filter
        if (showArchived && !task.archived) {
          return false;
        } else if (!showArchived && task.archived) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortField) {
          case 'Task Name':
            aValue = a["Task Name"]?.toLowerCase() || '';
            bValue = b["Task Name"]?.toLowerCase() || '';
            break;
          case 'Progress':
            const progressOrder = { 'Not started': 0, 'In progress': 1, 'Completed': 2, 'Backlog': 3 };
            aValue = progressOrder[a.Progress || 'Not started'];
            bValue = progressOrder[b.Progress || 'Not started'];
            break;
          case 'date_started':
            aValue = a.date_started ? new Date(a.date_started).getTime() : 0;
            bValue = b.date_started ? new Date(b.date_started).getTime() : 0;
            break;
          case 'date_due':
            aValue = a.date_due ? new Date(a.date_due).getTime() : 0;
            bValue = b.date_due ? new Date(b.date_due).getTime() : 0;
            break;
          default:
            return 0;
        }
        
        if (sortOrder === 'asc') {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      });
  }, [tasks, searchTerm, statusFilter, taskListFilter, showArchived, sortField, sortOrder]);

  return (
    <div className="space-y-4">
      <TaskFilters
        searchQuery={searchTerm}
        progressFilter={statusFilter as Task['Progress'] | 'all'}
        sortBy={sortField === 'date_started' ? 'date' : sortField === 'task_list_id' ? 'list' : 'project'}
        showNewTaskListDialog={false}
        showProjectModal={false}
        newTaskListName={newTaskListName}
        onSearchChange={setSearchTerm}
        onProgressFilterChange={(filter) => setStatusFilter(filter)}
        onSortByChange={(sort) => {
          if (sort === 'date') setSortField('date_started');
          else if (sort === 'list') setSortField('Task Name');
          else setSortField('Task Name');
        }}
        onNewTaskListDialogChange={() => {}}
        onProjectModalChange={() => {}}
        onNewTaskListNameChange={setNewTaskListName}
        onCreateTaskList={handleCreateTaskList}
      />
      
      <TaskListComponent
        tasks={filteredTasks}
        subtasks={allSubtasks}
        expandedTasks={expandedTasks}
        editingTaskId={editingTaskId}
        editingTaskName={editingTaskName}
        taskLists={taskLists}
        showArchived={showArchived}
        onToggleExpand={handleToggleExpand}
        onEditStart={handleEditStart}
        onEditCancel={handleEditCancel}
        onEditSave={handleEditSave}
        onEditNameChange={handleEditNameChange}
        onUpdateProgress={handleUpdateProgress}
        onMoveTask={handleMoveTask}
        onDeleteTask={handleDeleteTask}
        onTimelineEdit={handleTimelineEdit}
        onUnarchiveTask={handleUnarchiveTask}
      />

      <TaskEditModal
        task={editModalTask}
        open={!!editModalTask}
        onOpenChange={(open) => !open && setEditModalTask(null)}
        taskLists={taskLists}
        onTaskDurationChange={onTaskDurationChange}
      />
    </div>
  );
};
