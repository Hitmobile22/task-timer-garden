
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

  const filteredTasks = React.useMemo(() => 
    getSortedAndFilteredTasks(tasks, showArchived, searchQuery, progressFilter, sortBy),
    [tasks, showArchived, searchQuery, progressFilter, sortBy]
  );

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
          ) : (
            <TaskListComponent
              tasks={filteredTasks}
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
