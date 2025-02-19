
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TaskListComponent } from '@/components/task/TaskList';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from '@/components/ui/input';
import { Task, Subtask } from '@/types/task.types';

export function TaskView() {
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: tasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('date_started', { ascending: true });

      if (error) {
        console.error('Error fetching tasks:', error);
        throw error;
      }

      console.log('TaskView: Fetched tasks:', tasks?.length);
      return tasks;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data: projects, error } = await supabase
        .from('Projects')
        .select('*')
        .order('date_started', { ascending: true });

      if (error) {
        console.error('Error fetching projects:', error);
        throw error;
      }

      console.log('TaskView: Fetched projects:', projects?.length);
      return projects;
    },
  });

  const { data: taskLists } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('TaskLists')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Error fetching task lists:', error);
        throw error;
      }

      console.log('TaskView: Available task lists:', data);
      return data;
    },
  });

  const { data: subtasks } = useQuery({
    queryKey: ['today-subtasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
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

  const handleEditSave = async (taskId: number, isSubtask?: boolean) => {
    try {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ "Task Name": editingTaskName })
        .eq('id', taskId);

      if (error) throw error;

      setEditingTaskId(null);
      setEditingTaskName('');
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const handleUpdateProgress = async (taskId: number, progress: Task['Progress'], isSubtask?: boolean) => {
    try {
      const { error } = await supabase
        .from(isSubtask ? 'subtasks' : 'Tasks')
        .update({ Progress: progress })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating task progress:', error);
    }
  };

  const handleMoveTask = async (taskId: number, listId: number) => {
    try {
      const { error } = await supabase
        .from('Tasks')
        .update({ task_list_id: listId })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error moving task:', error);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      const { error } = await supabase
        .from('Tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const handleTimelineEdit = async (taskId: number, start: Date, end: Date) => {
    try {
      const { error } = await supabase
        .from('Tasks')
        .update({
          date_started: start.toISOString(),
          date_due: end.toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating task timeline:', error);
    }
  };

  const filteredTasks = tasks?.filter(task => {
    const matchesSearch = searchQuery
      ? task["Task Name"].toLowerCase().includes(searchQuery.toLowerCase())
      : true;

    const matchesFilter = filter === 'all'
      ? true
      : filter === 'active'
        ? task.Progress !== 'Completed'
        : task.Progress === 'Completed';

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Task View</h1>
        <div className="flex gap-4 items-center">
          <Input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[200px]"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFilter('all')}>
                All Tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('active')}>
                Active Tasks
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('completed')}>
                Completed Tasks
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <TaskListComponent
        tasks={filteredTasks || []}
        subtasks={subtasks}
        expandedTasks={expandedTasks}
        editingTaskId={editingTaskId}
        editingTaskName={editingTaskName}
        taskLists={taskLists || []}
        onToggleExpand={handleToggleExpand}
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
  );
}
