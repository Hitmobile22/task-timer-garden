
import React, { useState, useEffect, useCallback } from 'react';
import { TaskListComponent } from '@/components/task/TaskList';
import { TaskEditModal } from '@/components/task/TaskEditModal';
import { TaskFilters } from '@/components/task/TaskFilters';
import { Task, Subtask } from '@/types/task.types';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RecurringTasksModal } from '@/components/task/RecurringTasksModal';

export default function TaskView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [taskLists, setTaskLists] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>('');
  const [filters, setFilters] = useState({
    showArchived: false,
    taskListId: null,
    projectId: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('Tasks')
        .select('*')
        .order('date_started', { ascending: true });

      if (!filters.showArchived) {
        query = query.eq('archived', false);
      }

      if (filters.taskListId) {
        query = query.eq('task_list_id', filters.taskListId);
      }

      if (filters.projectId) {
        query = query.eq('project_id', filters.projectId);
      }

      const { data: tasksData, error: tasksError } = await query;

      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
        return;
      }

      const { data: subtasksData, error: subtasksError } = await supabase
        .from('subtasks')
        .select('*');

      if (subtasksError) {
        console.error("Error fetching subtasks:", subtasksError);
        return;
      }

      setTasks(tasksData || []);
      setSubtasks(subtasksData || []);
    } catch (error) {
      console.error("Unexpected error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filters.showArchived, filters.taskListId, filters.projectId]);

  const fetchTaskLists = useCallback(async () => {
    const { data, error } = await supabase
      .from('TaskLists')
      .select('*')
      .order('order', { ascending: true });

    if (error) {
      console.error("Error fetching task lists:", error);
    } else {
      setTaskLists(data || []);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    const { data, error } = await supabase
      .from('Projects')
      .select('*');

    if (error) {
      console.error("Error fetching projects:", error);
    } else {
      setProjects(data || []);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchTaskLists();
    fetchProjects();
  }, [fetchTasks, fetchTaskLists, fetchProjects]);

  const handleTaskCreated = (newTask: Task) => {
    setTasks([...tasks, newTask]);
    setShowForm(false);
  };

  const toggleTaskExpansion = (taskId: number) => {
    setExpandedTasks(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleEditStart = (task: Task) => {
    setEditingTask(task);
    setEditingTaskId(task.id);
    setEditingTaskName(task["Task Name"] || '');
  };

  const handleEditCancel = () => {
    setEditingTask(null);
    setEditingTaskId(null);
    setEditingTaskName('');
  };

  const handleEditSave = async (taskId: number) => {
    if (!editingTask) return;

    const { data, error } = await supabase
      .from('Tasks')
      .update({ "Task Name": editingTaskName })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error("Error updating task:", error);
      return;
    }

    setTasks(tasks.map(task => (task.id === taskId ? { ...task, "Task Name": editingTaskName } : task)));
    handleEditCancel();
    fetchTasks();
  };

  const handleUpdateProgress = async (taskId: number, progress: Task['Progress']) => {
    const { error } = await supabase
      .from('Tasks')
      .update({ Progress: progress })
      .eq('id', taskId);

    if (error) {
      console.error("Error updating task progress:", error);
      return;
    }

    setTasks(tasks.map(task => (task.id === taskId ? { ...task, Progress: progress } : task)));
    fetchTasks();
  };

  const handleMoveTask = async (taskId: number, listId: number) => {
    const { error } = await supabase
      .from('Tasks')
      .update({ task_list_id: listId })
      .eq('id', taskId);

    if (error) {
      console.error("Error moving task:", error);
      return;
    }

    setTasks(tasks.map(task => (task.id === taskId ? { ...task, task_list_id: listId } : task)));
    fetchTasks();
  };

  const handleDeleteTask = async (taskId: number) => {
    const { error } = await supabase
      .from('Tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error("Error deleting task:", error);
      return;
    }

    setTasks(tasks.filter(task => task.id !== taskId));
    fetchTasks();
  };

  const handleTimelineEdit = async (taskId: number, start: Date, end: Date) => {
    const { error } = await supabase
      .from('Tasks')
      .update({ date_started: start.toISOString(), date_due: end.toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error("Error updating task timeline:", error);
      return;
    }

    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        return { ...task, date_started: start.toISOString(), date_due: end.toISOString() };
      }
      return task;
    }));
    fetchTasks();
  };

  const filteredTasks = tasks.filter(task => {
    if (filters.showArchived) {
      return true;
    } else {
      return !task.archived;
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Task Manager</h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {showForm ? 'Cancel' : 'Add Task'}
          </Button>
          <TaskEditModal
            editingTask={editingTask}
            onClose={handleEditCancel}
            onSave={handleEditSave}
          />
        </div>
      </div>
      
      <TaskFilters
        showArchived={filters.showArchived}
        taskListId={filters.taskListId}
        projectId={filters.projectId}
        onShowArchivedChange={(showArchived) => setFilters(prev => ({ ...prev, showArchived }))}
        onTaskListChange={(taskListId) => setFilters(prev => ({ ...prev, taskListId }))}
        onProjectChange={(projectId) => setFilters(prev => ({ ...prev, projectId }))}
        taskLists={taskLists}
        availableProjects={projects}
      />
      
      {isLoading ? (
        <div>Loading tasks...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6">
          <TaskListComponent
            tasks={filteredTasks}
            subtasks={subtasks}
            expandedTasks={expandedTasks}
            editingTaskId={editingTaskId}
            editingTaskName={editingTaskName}
            taskLists={taskLists}
            showArchived={filters.showArchived}
            onToggleExpand={toggleTaskExpansion}
            onEditStart={handleEditStart}
            onEditCancel={handleEditCancel}
            onEditSave={handleEditSave}
            onEditNameChange={setEditingTaskName}
            onUpdateProgress={handleUpdateProgress}
            onMoveTask={handleMoveTask}
            onDeleteTask={handleDeleteTask}
            onTimelineEdit={handleTimelineEdit}
          />
        </div>
      )}
      
      <RecurringTasksModal />
    </div>
  );
}
