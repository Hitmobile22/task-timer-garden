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
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';

export function TaskView() {
  const navigate = useNavigate();
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState("");
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  const [progressFilter, setProgressFilter] = useState<Task['Progress'][]>(["Not started", "In progress"]);
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

  const organizedTasks = React.useMemo(() => {
    if (!tasks || !taskLists) return [];
    
    const filteredTasks = getSortedAndFilteredTasks(tasks, showArchived, searchQuery, progressFilter, sortBy);
    const result = [];

    if (!taskLists.length) {
      const defaultList = {
        id: 'default',
        name: 'Default List',
        color: DEFAULT_LIST_COLOR
      };

      const listTasks = filteredTasks.filter(task => !task.task_list_id);
      const listProjects = filteredProjects?.filter(project => !project.task_list_id) || [];

      if (listTasks.length > 0 || listProjects.length > 0) {
        result.push({
          type: 'list',
          id: 'list-default',
          name: defaultList.name,
          color: defaultList.color,
          projects: listProjects.map(project => ({
            type: 'project',
            id: `project-${project.id}`,
            name: project["Project Name"],
            progress: project.progress,
            tasks: filteredTasks.filter(task => task.project_id === project.id),
            parentList: defaultList
          })),
          tasks: listTasks
        });
      }
    }

    taskLists.forEach(list => {
      const listProjects = filteredProjects?.filter(project => project.task_list_id === list.id) || [];
      const projectComponents = listProjects.map(project => {
        const projectTasks = filteredTasks.filter(task => task.project_id === project.id);
        return {
          type: 'project',
          id: `project-${project.id}`,
          name: project["Project Name"],
          progress: project.progress,
          tasks: projectTasks,
          parentList: list
        };
      });

      const listTasks = filteredTasks.filter(
        task => task.task_list_id === list.id && !task.project_id
      );

      if (projectComponents.length > 0 || listTasks.length > 0) {
        result.push({
          type: 'list',
          id: `list-${list.id}`,
          name: list.name,
          color: list.color || DEFAULT_LIST_COLOR,
          projects: projectComponents,
          tasks: listTasks
        });
      }
    });

    return result;
  }, [tasks, taskLists, filteredProjects, showArchived, searchQuery, progressFilter, sortBy]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    const [activeType, activeItemId] = activeId.toString().split('-');
    const [overType, overItemId] = overId.toString().split('-');

    if (activeType === 'task' && overType === 'list') {
      toast.success('Task moved to new list');
    } else if (activeType === 'task' && overType === 'project') {
      toast.success('Task moved to project');
    }
  };

  const handleToggleExpand = (taskId: number) => {
    setExpandedTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      }
      return [...prev, taskId];
    });
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

  const handleCreateTaskList = () => {
    setShowNewTaskListDialog(false);
    setNewTaskListName("");
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
            <div className="space-y-6">
              {organizedTasks.map(list => (
                <div 
                  key={list.id}
                  className="space-y-4"
                >
                  <div 
                    className="p-4 rounded-lg"
                    style={{
                      background: list.color || DEFAULT_LIST_COLOR,
                    }}
                  >
                    <h2 className="text-xl font-bold text-white mb-4">{list.name}</h2>
                    
                    {list.projects.length > 0 && (
                      <div className="space-y-4 mb-4">
                        {list.projects.map(project => (
                          <div 
                            key={project.id}
                            className="p-4 rounded-lg bg-white/90 backdrop-blur-sm"
                          >
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                              <span>{project.name}</span>
                              <span className="text-sm font-normal text-gray-500">
                                ({project.progress})
                              </span>
                            </h3>
                            {project.tasks.length > 0 ? (
                              <TaskListComponent
                                tasks={project.tasks}
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
                                  }
                                }}
                                onEditNameChange={setEditingTaskName}
                                onUpdateProgress={(taskId, progress, isSubtask) => {
                                  updateProgressMutation.mutate({ taskId, progress, isSubtask });
                                }}
                                onMoveTask={() => {}}
                                onDeleteTask={deleteMutation.mutate}
                                onArchiveTask={archiveTaskMutation.mutate}
                                onAddSubtask={() => {}}
                                onTimelineEdit={(taskId, start, end) => {
                                  updateTaskTimelineMutation.mutate({ taskId, start, end });
                                }}
                                onBulkSelect={handleBulkSelect}
                                onBulkProgressUpdate={handleBulkProgressUpdate}
                              />
                            ) : (
                              <p className="text-gray-500 italic">No tasks in this project yet</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {list.tasks.length > 0 && (
                      <div className="bg-white/90 backdrop-blur-sm rounded-lg p-4">
                        <TaskListComponent
                          tasks={list.tasks}
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
                            }
                          }}
                          onEditNameChange={setEditingTaskName}
                          onUpdateProgress={(taskId, progress, isSubtask) => {
                            updateProgressMutation.mutate({ taskId, progress, isSubtask });
                          }}
                          onMoveTask={() => {}}
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
                    )}
                  </div>
                </div>
              ))}
            </div>
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
