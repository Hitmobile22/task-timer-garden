import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuBar } from "@/components/MenuBar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Task } from '@/types/task.types';
import { TaskListComponent } from '@/components/task/TaskList';
import { TaskFilters } from '@/components/task/TaskFilters';
import { GoogleCalendarIntegration } from '@/components/task/GoogleCalendarIntegration';
import { ProjectDialog } from '@/components/task/ProjectDialog';
import { PencilIcon, ListFilter, Folders } from "lucide-react";
import { DEFAULT_LIST_COLOR } from '@/constants/taskColors';
import { useTaskQueries } from '@/hooks/useTaskQueries';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { getSortedAndFilteredTasks, getFilteredProjects } from '@/utils/taskViewUtils';
import { supabase } from "@/integrations/supabase/client";

export function TaskView() {
  const navigate = useNavigate();
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

  const {
    projects,
    tasks,
    subtasks,
    taskLists,
    isLoading
  } = useTaskQueries();

  const {
    deleteMutation,
    updateProgressMutation,
    updateTaskNameMutation,
    updateTaskTimelineMutation,
    archiveTaskMutation
  } = useTaskMutations();

  const filteredProjects = React.useMemo(() => 
    getFilteredProjects(projects, searchQuery, progressFilter),
    [projects, searchQuery, progressFilter]
  );

  const filteredTasks = React.useMemo(() => {
    const filtered = getSortedAndFilteredTasks(tasks, showArchived, searchQuery, progressFilter, sortBy);
    
    if (sortBy === 'list') {
      // Group tasks by task list
      return taskLists?.map(list => ({
        list,
        tasks: filtered.filter(task => task.task_list_id === list.id)
      })) || [];
    }

    // For date sorting, return all tasks together
    return [{ tasks: filtered }];
  }, [tasks, showArchived, searchQuery, progressFilter, sortBy, taskLists]);

  const handleToggleExpand = (taskId: number) => {
    setExpandedTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      }
      return [...prev, taskId];
    });
  };

  const handleCreateTaskList = async () => {
    if (!newTaskListName.trim()) return;
    
    try {
      const { data, error } = await supabase
        .from('TaskLists')
        .insert([{
          name: newTaskListName,
          color: DEFAULT_LIST_COLOR,
          order: (taskLists?.length || 0)
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Task list created successfully');
      setShowNewTaskListDialog(false);
      setNewTaskListName("");
    } catch (error) {
      toast.error('Failed to create task list');
      console.error('Create task list error:', error);
    }
  };

  const handleMoveTask = async (taskId: number, listId: number) => {
    try {
      const { error } = await supabase
        .from('Tasks')
        .update({ task_list_id: listId })
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Task moved successfully');
    } catch (error) {
      toast.error('Failed to move task');
      console.error('Move task error:', error);
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

  const handleBulkSelect = (taskId: number, selected: boolean) => {
    setSelectedTasks(prev => 
      selected 
        ? [...prev, taskId]
        : prev.filter(id => id !== taskId)
    );
  };

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
              onProgressFilterChange={(progress) => {
                setProgressFilter(prev => {
                  if (prev.includes(progress)) {
                    return prev.filter(p => p !== progress);
                  }
                  return [...prev, progress];
                });
              }}
              onSortByChange={setSortBy}
              onNewTaskListDialogChange={setShowNewTaskListDialog}
              onNewTaskListNameChange={setNewTaskListName}
              onCreateTaskList={handleCreateTaskList}
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

          {isLoading ? (
            <div>Loading...</div>
          ) : sortBy === 'list' ? (
            <div className="space-y-8">
              {filteredTasks.map(({ list, tasks }) => (
                <div key={list?.id || 'unsorted'} className="space-y-4">
                  {list && (
                    <div 
                      className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-lg shadow-sm"
                      style={{ borderLeft: `4px solid ${list.color || DEFAULT_LIST_COLOR}` }}
                    >
                      <h3 className="text-lg font-semibold">{list.name}</h3>
                      <span className="text-sm text-gray-500">({tasks.length})</span>
                    </div>
                  )}
                  <TaskListComponent
                    tasks={tasks}
                    subtasks={subtasks}
                    expandedTasks={expandedTasks}
                    editingTaskId={editingTaskId}
                    editingTaskName={editingTaskName}
                    taskLists={taskLists || []}
                    bulkMode={bulkMode}
                    selectedTasks={selectedTasks}
                    showArchived={showArchived}
                    onToggleExpand={handleToggleExpand}
                    onEditStart={(task) => {
                      setEditingTaskId(task.id);
                      setEditingTaskName(task["Task Name"]);
                    }}
                    onEditCancel={() => {
                      setEditingTaskId(null);
                      setEditingTaskName("");
                    }}
                    onEditSave={(taskId, isSubtask) => {
                      if (editingTaskName.trim()) {
                        updateTaskNameMutation.mutate({ taskId, taskName: editingTaskName, isSubtask });
                        setEditingTaskId(null);
                        setEditingTaskName("");
                      }
                    }}
                    onEditNameChange={setEditingTaskName}
                    onUpdateProgress={(taskId, progress, isSubtask) => {
                      updateProgressMutation.mutate({ taskId, progress, isSubtask });
                    }}
                    onMoveTask={handleMoveTask}
                    onDeleteTask={deleteMutation.mutate}
                    onArchiveTask={archiveTaskMutation.mutate}
                    onAddSubtask={() => {}}
                    onTimelineEdit={(taskId, start, end) => {
                      updateTaskTimelineMutation.mutate({ taskId, start, end });
                    }}
                    onBulkSelect={handleBulkSelect}
                    onBulkProgressUpdate={handleBulkProgressUpdate}
                  />
                </div>
              ))}
            </div>
          ) : (
            <TaskListComponent
              tasks={filteredTasks[0]?.tasks || []}
              subtasks={subtasks}
              expandedTasks={expandedTasks}
              editingTaskId={editingTaskId}
              editingTaskName={editingTaskName}
              taskLists={taskLists || []}
              bulkMode={bulkMode}
              selectedTasks={selectedTasks}
              showArchived={showArchived}
              onToggleExpand={handleToggleExpand}
              onEditStart={(task) => {
                setEditingTaskId(task.id);
                setEditingTaskName(task["Task Name"]);
              }}
              onEditCancel={() => {
                setEditingTaskId(null);
                setEditingTaskName("");
              }}
              onEditSave={(taskId, isSubtask) => {
                if (editingTaskName.trim()) {
                  updateTaskNameMutation.mutate({ taskId, taskName: editingTaskName, isSubtask });
                  setEditingTaskId(null);
                  setEditingTaskName("");
                }
              }}
              onEditNameChange={setEditingTaskName}
              onUpdateProgress={(taskId, progress, isSubtask) => {
                updateProgressMutation.mutate({ taskId, progress, isSubtask });
              }}
              onMoveTask={handleMoveTask}
              onDeleteTask={deleteMutation.mutate}
              onArchiveTask={archiveTaskMutation.mutate}
              onAddSubtask={() => {}}
              onTimelineEdit={(taskId, start, end) => {
                updateTaskTimelineMutation.mutate({ taskId, start, end });
              }}
              onBulkSelect={handleBulkSelect}
              onBulkProgressUpdate={handleBulkProgressUpdate}
            />
          )}
        </div>
      </main>

      <ProjectDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        onCreateProject={() => {}}
      />
    </div>
  );
}

export default TaskView;
