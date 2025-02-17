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
import { PencilIcon, ListFilter, Folders, Trash2 } from "lucide-react";
import { DEFAULT_LIST_COLOR, TASK_LIST_COLORS } from '@/constants/taskColors';
import { useTaskQueries } from '@/hooks/useTaskQueries';
import { useTaskMutations } from '@/hooks/useTaskMutations';
import { getSortedAndFilteredTasks, getFilteredProjects, getTaskListColor } from '@/utils/taskViewUtils';
import { supabase } from "@/integrations/supabase/client";
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

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

  const handleAddSubtask = async (parentTaskId: number) => {
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
  };

  const handleMoveTask = async (taskId: number, listId: number, projectId?: number) => {
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
  };

  const handleDeleteProject = async (projectId: number) => {
    try {
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
  };

  const handleDeleteTaskList = async (listId: number) => {
    try {
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
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = Number(active.id.toString().replace('task-', ''));
    const overId = Number(over.id.toString().replace('task-', ''));
    
    const activeTask = tasks?.find(t => t.id === activeId);
    const overTask = tasks?.find(t => t.id === overId);
    
    if (!activeTask || !overTask) return;

    try {
      await handleMoveTask(
        activeTask.id,
        overTask.task_list_id ?? activeTask.task_list_id ?? 0,
        overTask.project_id
      );

      toast.success('Task moved successfully');
    } catch (error) {
      console.error('Move task error:', error);
      toast.error('Failed to move task');
    }
  };

  const filteredProjects = React.useMemo(() => 
    getFilteredProjects(projects, searchQuery, progressFilter),
    [projects, searchQuery, progressFilter]
  );

  const filteredTasks = React.useMemo(() => {
    const filtered = getSortedAndFilteredTasks(tasks, showArchived, searchQuery, progressFilter, sortBy);
    
    if (sortBy === 'list') {
      return taskLists?.map(list => ({
        list,
        projects: getFilteredProjects(projects, searchQuery, progressFilter)
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
  }, [tasks, projects, showArchived, searchQuery, progressFilter, sortBy, taskLists]);

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

          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {isLoading ? (
              <div>Loading...</div>
            ) : sortBy === 'list' ? (
              <div className="space-y-8">
                {filteredTasks.map(({ list, projects = [], tasks }) => (
                  <div key={list?.id || 'unsorted'} className="space-y-4">
                    {list && (
                      <div 
                        className="flex items-center justify-between px-4 py-2 rounded-lg shadow-sm"
                        style={{ 
                          background: `linear-gradient(to right, ${list.color || getTaskListColor(list.name) || DEFAULT_LIST_COLOR}15, ${list.color || getTaskListColor(list.name) || DEFAULT_LIST_COLOR}30)`,
                          borderLeft: `4px solid ${list.color || getTaskListColor(list.name) || DEFAULT_LIST_COLOR}` 
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{list.name}</h3>
                          <span className="text-sm text-gray-500">
                            ({tasks.length + projects.reduce((sum, p) => sum + p.tasks.length, 0)} tasks)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTaskList(list.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    
                    {projects.map(({ project, tasks: projectTasks }) => (
                      <div key={project.id} className="ml-4 space-y-2">
                        <div className="flex items-center justify-between px-4 py-2 bg-white/30 rounded-lg">
                          <div className="flex items-center gap-2">
                            <h4 className="text-md font-medium">{project["Project Name"]}</h4>
                            <span className="text-sm text-gray-500">({projectTasks.length})</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProject(project.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="ml-4">
                          <SortableContext items={projectTasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
                            <TaskListComponent
                              tasks={projectTasks}
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
                              onAddSubtask={handleAddSubtask}
                              onTimelineEdit={(taskId, start, end) => {
                                updateTaskTimelineMutation.mutate({ taskId, start, end });
                              }}
                              onBulkSelect={handleBulkSelect}
                              onBulkProgressUpdate={handleBulkProgressUpdate}
                            />
                          </SortableContext>
                        </div>
                      </div>
                    ))}
                    
                    <div className="ml-4">
                      <SortableContext items={tasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
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
                          onAddSubtask={handleAddSubtask}
                          onTimelineEdit={(taskId, start, end) => {
                            updateTaskTimelineMutation.mutate({ taskId, start, end });
                          }}
                          onBulkSelect={handleBulkSelect}
                          onBulkProgressUpdate={handleBulkProgressUpdate}
                        />
                      </SortableContext>
                    </div>
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
                onAddSubtask={handleAddSubtask}
                onTimelineEdit={(taskId, start, end) => {
                  updateTaskTimelineMutation.mutate({ taskId, start, end });
                }}
                onBulkSelect={handleBulkSelect}
                onBulkProgressUpdate={handleBulkProgressUpdate}
              />
            )}
          </DndContext>
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
