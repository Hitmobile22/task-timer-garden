import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2, PencilIcon, Check, X, ChevronRight, ChevronDown, Clock, ArrowUpDown, Filter, ListFilter } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

type Task = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  date_started?: string;
  date_due?: string;
  task_list_id: number | null;
};

type Subtask = {
  id: number;
  "Task Name": string;
  Progress: "Not started" | "In progress" | "Completed" | "Backlog";
  "Parent Task ID": number;
};

type SortField = "Task Name" | "Progress" | "date_started" | "date_due";
type SortOrder = "asc" | "desc";

const TASK_LIST_COLORS = {
  'Default': '#8E9196',
  'Personal': '#9b87f5',
  'Work': '#7E69AB',
  'Shopping': '#6E59A5',
  'Health': '#D6BCFA',
  'Learning': '#F2FCE2',
  'Projects': '#FEF7CD',
  'Home': '#FEC6A1',
  'Ideas': '#E5DEFF',
  'Goals': '#FFDEE2',
};

export default function TaskView() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingTaskId, setEditingTaskId] = React.useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = React.useState("");
  const [expandedTasks, setExpandedTasks] = React.useState<number[]>([]);
  const [sortField, setSortField] = React.useState<SortField>("Task Name");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc");
  const [progressFilter, setProgressFilter] = React.useState<Task['Progress'] | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("");

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

  const getSortedAndFilteredTasks = (tasks: Task[] | undefined) => {
    if (!tasks) return [];
    
    let filteredTasks = [...tasks];
    
    // Apply progress filter
    if (progressFilter !== "all") {
      filteredTasks = filteredTasks.filter(task => task.Progress === progressFilter);
    }
    
    // Apply search filter
    if (searchQuery) {
      filteredTasks = filteredTasks.filter(task => 
        task["Task Name"].toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    return filteredTasks.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      if (!aValue || !bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === "asc" ? comparison : -comparison;
    });
  };

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

  const updateTaskListMutation = useMutation({
    mutationFn: async ({ taskId, taskListId }: { taskId: number; taskListId: number }) => {
      const { error } = await supabase
        .from('Tasks')
        .update({ task_list_id: taskListId })
        .eq('id', taskId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task list updated');
    },
    onError: (error) => {
      toast.error('Failed to update task list');
      console.error('Update error:', error);
    },
  });

  // Group tasks by task list
  const groupedTasks = React.useMemo(() => {
    if (!tasks || !taskLists) return new Map();
    
    const grouped = new Map();
    taskLists.forEach(list => {
      grouped.set(list.id, {
        list,
        tasks: tasks.filter(task => task.task_list_id === list.id)
      });
    });
    
    // Add uncategorized tasks to "Default" list
    const uncategorizedTasks = tasks.filter(task => !task.task_list_id);
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
  }, [tasks, taskLists]);

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
          <div className="mb-6 space-y-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex-1 min-w-[200px] max-w-sm">
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex items-center gap-4">
                <Select
                  value={progressFilter}
                  onValueChange={(value: Task['Progress'] | "all") => setProgressFilter(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      <SelectValue placeholder="Filter by status" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Not started">Not Started</SelectItem>
                    <SelectItem value="In progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Backlog">Backlog</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DndContext collisionDetection={closestCenter}>
            {Array.from(groupedTasks.values()).map(({ list, tasks: listTasks }) => (
              <div key={list.id} className="mb-8">
                <div 
                  className="mb-4 p-2 rounded"
                  style={{
                    backgroundColor: TASK_LIST_COLORS[list.name] || TASK_LIST_COLORS['Default'],
                    color: list.name === 'Default' ? 'white' : 'inherit'
                  }}
                >
                  <h3 className="text-lg font-semibold">{list.name}</h3>
                </div>
                <SortableContext items={listTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Timeline</TableHead>
                        <TableHead className="w-[200px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {subtasks?.some(st => st["Parent Task ID"] === task.id) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 p-0"
                                  onClick={() => toggleTaskExpansion(task.id)}
                                >
                                  {expandedTasks.includes(task.id) ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </Button>
                              )}
                              {editingTaskId === task.id ? (
                                <div className="flex items-center gap-2 flex-grow">
                                  <Input
                                    value={editingTaskName}
                                    onChange={(e) => setEditingTaskName(e.target.value)}
                                    className="w-full"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditSave(task.id)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleEditCancel}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                task["Task Name"]
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={task.Progress}
                              onValueChange={(value: Task['Progress']) => 
                                updateProgressMutation.mutate({ taskId: task.id, progress: value })
                              }
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select progress" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Not started">Not started</SelectItem>
                                <SelectItem value="In progress">In progress</SelectItem>
                                <SelectItem value="Completed">Completed</SelectItem>
                                <SelectItem value="Backlog">Backlog</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {task.date_started && task.date_due && (
                              <div className="flex flex-col gap-1 text-sm">
                                <div className="flex items-center gap-2 text-primary">
                                  <Clock className="h-3 w-3" />
                                  <span>Starts: {formatDate(task.date_started)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-primary/80">
                                  <Clock className="h-3 w-3" />
                                  <span>Due: {formatDate(task.date_due)}</span>
                                </div>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={task.task_list_id?.toString() || ''}
                                onValueChange={(value) => 
                                  updateTaskListMutation.mutate({ 
                                    taskId: task.id, 
                                    taskListId: parseInt(value) 
                                  })
                                }
                              >
                                <SelectTrigger className="w-[150px]">
                                  <div className="flex items-center gap-2">
                                    <ListFilter className="h-4 w-4" />
                                    <SelectValue placeholder="Move to list" />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  {taskLists?.map((list) => (
                                    <SelectItem 
                                      key={list.id} 
                                      value={list.id.toString()}
                                      className="flex items-center gap-2"
                                    >
                                      <div 
                                        className="w-2 h-2 rounded-full"
                                        style={{ 
                                          backgroundColor: TASK_LIST_COLORS[list.name] || TASK_LIST_COLORS['Default']
                                        }} 
                                      />
                                      {list.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {editingTaskId !== task.id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditStart(task)}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(task.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>
              </div>
            ))}
          </DndContext>
        </div>
      </main>
    </div>
  );
}
