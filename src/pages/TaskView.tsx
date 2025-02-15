import React, { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, Subtask, SortField, SortOrder } from '@/types/task.types';
import { TaskListComponent } from '@/components/task/TaskList';
import { TaskFilters } from '@/components/task/TaskFilters';
import { generateRandomColor } from '@/utils/taskUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [showEditTimelineDialog, setShowEditTimelineDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [timelineDate, setTimelineDate] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date(new Date().setHours(new Date().getHours() + 1))
  });
  const [sortBy, setSortBy] = useState<'date' | 'list'>('list');

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
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as Subtask[];
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
    mutationFn: async ({ listId, name }: { listId: number; name: string }) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ task_list_id: listId })
        .eq('id', parseInt(name)); // Convert the string ID to a number
      
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
      setShowEditTimelineDialog(false);
      setSelectedTaskId(null);
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
    
    // Apply search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filteredTasks = filteredTasks.filter(task => 
        task["Task Name"]?.toLowerCase().includes(searchLower)
      );
    }
    
    // Apply progress filter
    if (progressFilter !== "all") {
      filteredTasks = filteredTasks.filter(task => task.Progress === progressFilter);
    }
    
    // Apply sorting
    if (sortBy === 'date') {
      return filteredTasks.sort((a, b) => {
        const aDate = a.date_started ? new Date(a.date_started) : new Date(0);
        const bDate = b.date_started ? new Date(b.date_started) : new Date(0);
        return aDate.getTime() - bDate.getTime();
      });
    }
    
    // Sort by list
    return filteredTasks.sort((a, b) => {
      const aListId = a.task_list_id || 0;
      const bListId = b.task_list_id || 0;
      return aListId - bListId;
    });
  }, [progressFilter, searchQuery, sortBy]);

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

  const filteredAndGroupedTasks = React.useMemo(() => {
    if (!tasks || !taskLists) return new Map();
    
    const filteredTasks = getSortedAndFilteredTasks(tasks);
    const grouped = new Map();
    
    taskLists.forEach(list => {
      const listTasks = filteredTasks.filter(task => task.task_list_id === list.id);
      if (listTasks.length > 0) {
        grouped.set(list.id, {
          list,
          tasks: listTasks
        });
      }
    });
    
    // Add uncategorized tasks
    const uncategorizedTasks = filteredTasks.filter(task => !task.task_list_id);
    if (uncategorizedTasks.length > 0) {
      const defaultList = taskLists.find(list => list.name === 'Default');
      if (defaultList) {
        grouped.set(defaultList.id, {
          list: defaultList,
          tasks: uncategorizedTasks
        });
      }
    }
    
    return grouped;
  }, [tasks, taskLists, getSortedAndFilteredTasks]);

  const handleTimelineDialogSave = () => {
    if (selectedTaskId && timelineDate.start && timelineDate.end) {
      updateTaskTimelineMutation.mutate({
        taskId: selectedTaskId,
        start: timelineDate.start,
        end: timelineDate.end
      });
    }
  };

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-4xl">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      
      <main className="container mx-auto max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Task Manager</h1>
          <p className="text-white/80">View and manage your tasks</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
          <TaskFilters
            searchQuery={searchQuery}
            progressFilter={progressFilter}
            sortBy={sortBy}
            showNewTaskListDialog={showNewTaskListDialog}
            newTaskListName={newTaskListName}
            onSearchChange={setSearchQuery}
            onProgressFilterChange={setProgressFilter}
            onSortByChange={setSortBy}
            onNewTaskListDialogChange={setShowNewTaskListDialog}
            onNewTaskListNameChange={setNewTaskListName}
            onCreateTaskList={() => createTaskListMutation.mutate(newTaskListName)}
          />

          {sortBy === 'list' ? (
            <DndContext collisionDetection={closestCenter}>
              {Array.from(filteredAndGroupedTasks.values()).map(({ list, tasks: listTasks }) => {
                if (listTasks.length === 0) return null;
                
                return (
                  <div key={list.id} className="mb-8">
                    <div 
                      className="mb-4 p-2 rounded flex items-center justify-between"
                      style={{
                        background: list.color || DEFAULT_LIST_COLOR,
                        color: 'white'
                      }}
                    >
                      {editingListId === list.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            value={editingListName}
                            onChange={(e) => setEditingListName(e.target.value)}
                            className="max-w-sm bg-white/90 text-gray-900 font-medium"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateListNameMutation.mutate({
                              listId: list.id,
                              name: editingListName
                            })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingListId(null);
                              setEditingListName("");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-white">{list.name}</h3>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-white hover:bg-white/20"
                              onClick={() => {
                                setEditingListId(list.id);
                                setEditingListName(list.name);
                              }}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </Button>
                            {list.name !== 'Day to Day' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-white hover:bg-white/20"
                                onClick={() => deleteTaskListMutation.mutate(list.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <SortableContext items={listTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                      <TaskListComponent
                        tasks={listTasks}
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
                        onMoveTask={(taskId, listId) => 
                          updateTaskListMutation.mutate({ listId, name: taskId.toString() })
                        }
                        onDeleteTask={(taskId) => deleteMutation.mutate(taskId)}
                        onTimelineEdit={(taskId, start, end) => {
                          setSelectedTaskId(taskId);
                          setTimelineDate({ start, end });
                          setShowEditTimelineDialog(true);
                        }}
                      />
                    </SortableContext>
                  </div>
                );
              })}
            </DndContext>
          ) : (
            <TaskListComponent
              tasks={getSortedAndFilteredTasks(tasks)}
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
              onMoveTask={(taskId, listId) => 
                updateTaskListMutation.mutate({ listId, name: taskId.toString() })
              }
              onDeleteTask={(taskId) => deleteMutation.mutate(taskId)}
              onTimelineEdit={(taskId, start, end) => {
                setSelectedTaskId(taskId);
                setTimelineDate({ 
                  start: new Date(start),
                  end: new Date(end)
                });
                setShowEditTimelineDialog(true);
              }}
            />
          )}
        </div>
      </main>

      <Dialog open={showEditTimelineDialog} onOpenChange={setShowEditTimelineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task Timeline</DialogTitle>
            <DialogDescription>
              Set the start and due time for this task
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Start Time</label>
              <input
                type="datetime-local"
                value={timelineDate.start?.toISOString().slice(0, 16)}
                onChange={(e) => setTimelineDate(prev => ({
                  ...prev,
                  start: new Date(e.target.value)
                }))}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Time</label>
              <input
                type="datetime-local"
                value={timelineDate.end?.toISOString().slice(0, 16)}
                onChange={(e) => setTimelineDate(prev => ({
                  ...prev,
                  end: new Date(e.target.value)
                }))}
                className="w-full mt-1 px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditTimelineDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleTimelineDialogSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TaskView;
