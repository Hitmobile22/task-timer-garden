
import React from 'react';
import { TaskFilters } from './TaskFilters';
import { TaskListComponent } from './TaskList';
import { Button } from "@/components/ui/button";
import { GoogleCalendarIntegration } from './GoogleCalendarIntegration';
import { PencilIcon, ListFilter, Folders, Trash2 } from "lucide-react";
import { DEFAULT_LIST_COLOR } from '@/constants/taskColors';
import { getTaskListColor } from '@/utils/taskViewUtils';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export const TaskViewContent = ({ state, handlers, queries, mutations }) => {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <TaskFilters
          searchQuery={state.searchQuery}
          progressFilter={state.progressFilter}
          sortBy={state.sortBy}
          showNewTaskListDialog={state.showNewTaskListDialog}
          newTaskListName={state.newTaskListName}
          onSearchChange={handlers.setSearchQuery}
          onProgressFilterChange={(progress) => {
            handlers.setProgressFilter(prev => {
              if (prev.includes(progress)) {
                return prev.filter(p => p !== progress);
              }
              return [...prev, progress];
            });
          }}
          onSortByChange={handlers.setSortBy}
          onNewTaskListDialogChange={handlers.setShowNewTaskListDialog}
          onNewTaskListNameChange={handlers.setNewTaskListName}
          onCreateTaskList={handlers.handleCreateTaskList}
        />
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => handlers.setShowProjectDialog(true)}
            className="flex items-center gap-2"
          >
            <Folders className="w-4 h-4" />
            New Project
          </Button>
          <Button
            variant="outline"
            onClick={() => handlers.setBulkMode(!state.bulkMode)}
            className={state.bulkMode ? "bg-primary text-white" : ""}
          >
            <PencilIcon className="w-4 h-4 mr-2" />
            Bulk Edit
          </Button>
          <Button
            variant="outline"
            onClick={() => handlers.setShowArchived(!state.showArchived)}
          >
            <ListFilter className="w-4 h-4 mr-2" />
            {state.showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
          <GoogleCalendarIntegration />
        </div>
      </div>

      <DndContext collisionDetection={closestCenter} onDragEnd={handlers.handleDragEnd}>
        {queries.isLoading ? (
          <div>Loading...</div>
        ) : state.sortBy === 'list' ? (
          <div className="space-y-8">
            {state.filteredTasks.map(({ list, projects = [], tasks }) => (
              <div key={list?.id || 'unsorted'} 
                   className="space-y-4 relative" 
                   data-id={`list-${list?.id}`}>
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
                    {list.id !== 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlers.handleDeleteTaskList(list.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
                
                {projects.map(({ project, tasks: projectTasks }) => (
                  <div 
                    key={project.id} 
                    className="ml-4 space-y-2"
                    data-id={`project-${project.id}`}
                  >
                    <div className="flex items-center justify-between px-4 py-2 bg-white/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <h4 className="text-md font-medium">{project["Project Name"]}</h4>
                        <span className="text-sm text-gray-500">({projectTasks.length})</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlers.handleDeleteProject(project.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="ml-4">
                      <SortableContext items={projectTasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
                        <div className={`min-h-[100px] ${projectTasks.length === 0 ? 'bg-gray-50/50 rounded-lg p-4' : ''}`}>
                          <TaskListComponent
                            tasks={projectTasks}
                            subtasks={queries.subtasks}
                            expandedTasks={state.expandedTasks}
                            editingTaskId={state.editingTaskId}
                            editingTaskName={state.editingTaskName}
                            taskLists={queries.taskLists || []}
                            bulkMode={state.bulkMode}
                            selectedTasks={state.selectedTasks}
                            showArchived={state.showArchived}
                            showHeader={projectTasks.length > 0}
                            onToggleExpand={handlers.handleToggleExpand}
                            onEditStart={(task) => {
                              handlers.setEditingTaskId(task.id);
                              handlers.setEditingTaskName(task["Task Name"]);
                            }}
                            onEditCancel={() => {
                              handlers.setEditingTaskId(null);
                              handlers.setEditingTaskName("");
                            }}
                            onEditSave={(taskId, isSubtask) => {
                              if (state.editingTaskName.trim()) {
                                mutations.updateTaskNameMutation.mutate({ 
                                  taskId, 
                                  taskName: state.editingTaskName, 
                                  isSubtask 
                                });
                                handlers.setEditingTaskId(null);
                                handlers.setEditingTaskName("");
                              }
                            }}
                            onEditNameChange={handlers.setEditingTaskName}
                            onUpdateProgress={(taskId, progress, isSubtask) => {
                              mutations.updateProgressMutation.mutate({ taskId, progress, isSubtask });
                            }}
                            onMoveTask={handlers.handleMoveTask}
                            onDeleteTask={mutations.deleteMutation.mutate}
                            onArchiveTask={mutations.archiveTaskMutation.mutate}
                            onAddSubtask={handlers.handleAddSubtask}
                            onTimelineEdit={(taskId, start, end) => {
                              mutations.updateTaskTimelineMutation.mutate({ taskId, start, end });
                            }}
                            onBulkSelect={handlers.handleBulkSelect}
                            onBulkProgressUpdate={handlers.handleBulkProgressUpdate}
                          />
                        </div>
                      </SortableContext>
                    </div>
                  </div>
                ))}
                
                <div className="ml-4">
                  <SortableContext items={tasks.map(t => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
                    <TaskListComponent
                      tasks={tasks}
                      subtasks={queries.subtasks}
                      expandedTasks={state.expandedTasks}
                      editingTaskId={state.editingTaskId}
                      editingTaskName={state.editingTaskName}
                      taskLists={queries.taskLists || []}
                      bulkMode={state.bulkMode}
                      selectedTasks={state.selectedTasks}
                      showArchived={state.showArchived}
                      onToggleExpand={handlers.handleToggleExpand}
                      onEditStart={(task) => {
                        handlers.setEditingTaskId(task.id);
                        handlers.setEditingTaskName(task["Task Name"]);
                      }}
                      onEditCancel={() => {
                        handlers.setEditingTaskId(null);
                        handlers.setEditingTaskName("");
                      }}
                      onEditSave={(taskId, isSubtask) => {
                        if (state.editingTaskName.trim()) {
                          mutations.updateTaskNameMutation.mutate({ 
                            taskId, 
                            taskName: state.editingTaskName, 
                            isSubtask 
                          });
                          handlers.setEditingTaskId(null);
                          handlers.setEditingTaskName("");
                        }
                      }}
                      onEditNameChange={handlers.setEditingTaskName}
                      onUpdateProgress={(taskId, progress, isSubtask) => {
                        mutations.updateProgressMutation.mutate({ taskId, progress, isSubtask });
                      }}
                      onMoveTask={handlers.handleMoveTask}
                      onDeleteTask={mutations.deleteMutation.mutate}
                      onArchiveTask={mutations.archiveTaskMutation.mutate}
                      onAddSubtask={handlers.handleAddSubtask}
                      onTimelineEdit={(taskId, start, end) => {
                        mutations.updateTaskTimelineMutation.mutate({ taskId, start, end });
                      }}
                      onBulkSelect={handlers.handleBulkSelect}
                      onBulkProgressUpdate={handlers.handleBulkProgressUpdate}
                    />
                  </SortableContext>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <TaskListComponent
            tasks={state.filteredTasks[0]?.tasks || []}
            subtasks={queries.subtasks}
            expandedTasks={state.expandedTasks}
            editingTaskId={state.editingTaskId}
            editingTaskName={state.editingTaskName}
            taskLists={queries.taskLists || []}
            bulkMode={state.bulkMode}
            selectedTasks={state.selectedTasks}
            showArchived={state.showArchived}
            onToggleExpand={handlers.handleToggleExpand}
            onEditStart={(task) => {
              handlers.setEditingTaskId(task.id);
              handlers.setEditingTaskName(task["Task Name"]);
            }}
            onEditCancel={() => {
              handlers.setEditingTaskId(null);
              handlers.setEditingTaskName("");
            }}
            onEditSave={(taskId, isSubtask) => {
              if (state.editingTaskName.trim()) {
                mutations.updateTaskNameMutation.mutate({ 
                  taskId, 
                  taskName: state.editingTaskName, 
                  isSubtask 
                });
                handlers.setEditingTaskId(null);
                handlers.setEditingTaskName("");
              }
            }}
            onEditNameChange={handlers.setEditingTaskName}
            onUpdateProgress={(taskId, progress, isSubtask) => {
              mutations.updateProgressMutation.mutate({ taskId, progress, isSubtask });
            }}
            onMoveTask={handlers.handleMoveTask}
            onDeleteTask={mutations.deleteMutation.mutate}
            onArchiveTask={mutations.archiveTaskMutation.mutate}
            onAddSubtask={handlers.handleAddSubtask}
            onTimelineEdit={(taskId, start, end) => {
              mutations.updateTaskTimelineMutation.mutate({ taskId, start, end });
            }}
            onBulkSelect={handlers.handleBulkSelect}
            onBulkProgressUpdate={handlers.handleBulkProgressUpdate}
          />
        )}
      </DndContext>
    </>
  );
};
