
import React, { useState, useEffect } from 'react';
import { 
  ArrowUpDown, 
  Filter, 
  ListFilter, 
  Plus, 
  PencilIcon, 
  Check, 
  X, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  Edit2, 
  Trash2, 
  Repeat, 
  Trophy, 
  Goal 
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TaskNameCell } from "@/components/task/cells/TaskNameCell";
import { TaskProgressCell } from "@/components/task/cells/TaskProgressCell";
import { TaskActionsCell } from "@/components/task/cells/TaskActionsCell";
import { Task, Subtask } from "@/types/task.types";
import { TaskFilters } from "@/components/task/TaskFilters";

// Dummy data for demonstration
const dummyTasks: Task[] = [
  {
    id: 1,
    "Task Name": "Complete project proposal",
    project_id: 1,
    task_list_id: 1,
    Progress: "In progress",
    date_created: new Date().toISOString(),
    date_started: new Date().toISOString(),
    estimated_time: 120,
    time_spent: 0,
    parent_task_id: null
  },
  {
    id: 2,
    "Task Name": "Research competitors",
    project_id: 1,
    task_list_id: 2,
    Progress: "Not started",
    date_created: new Date().toISOString(),
    date_started: new Date().toISOString(),
    estimated_time: 90,
    time_spent: 0,
    parent_task_id: null
  },
  {
    id: 3,
    "Task Name": "Create wireframes",
    project_id: 2,
    task_list_id: 1,
    Progress: "Completed",
    date_created: new Date().toISOString(),
    date_started: new Date().toISOString(),
    estimated_time: 150,
    time_spent: 150,
    parent_task_id: null
  }
];

const dummySubtasks: Subtask[] = [
  {
    id: 4,
    "Task Name": "Research main competitors",
    "Parent Task ID": 2,
    Progress: "Not started",
    date_started: new Date().toISOString(),
    estimated_time: 45,
    time_spent: 0
  },
  {
    id: 5,
    "Task Name": "Analyze market positioning",
    "Parent Task ID": 2,
    Progress: "Not started",
    date_started: new Date().toISOString(),
    estimated_time: 45,
    time_spent: 0
  }
];

const dummyTaskLists = [
  { id: 1, name: "To Do", color: "#3b82f6" },
  { id: 2, name: "In Progress", color: "#f59e0b" },
  { id: 3, name: "Done", color: "#10b981" }
];

const TaskView = () => {
  const [tasks, setTasks] = useState<Task[]>(dummyTasks);
  const [subtasks, setSubtasks] = useState<Subtask[]>(dummySubtasks);
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>("");
  
  // State for TaskFilters props
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [progressFilter, setProgressFilter] = useState<Task['Progress'] | "all">("all");
  const [sortBy, setSortBy] = useState<'date' | 'list' | 'project'>('date');
  const [showNewTaskListDialog, setShowNewTaskListDialog] = useState<boolean>(false);
  const [showProjectModal, setShowProjectModal] = useState<boolean>(false);
  const [newTaskListName, setNewTaskListName] = useState<string>("");

  const handleToggleExpand = (taskId: number) => {
    setExpandedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId) 
        : [...prev, taskId]
    );
  };

  const handleEditStart = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingTaskName(task["Task Name"]);
  };

  const handleEditSave = (taskId: number) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, "Task Name": editingTaskName }
          : task
      )
    );
    setSubtasks(prev => 
      prev.map(subtask => 
        subtask.id === taskId 
          ? { ...subtask, "Task Name": editingTaskName }
          : subtask
      )
    );
    setEditingTaskId(null);
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
  };

  const handleUpdateProgress = (taskId: number, progress: Task['Progress']) => {
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, Progress: progress }
          : task
      )
    );
    setSubtasks(prev => 
      prev.map(subtask => 
        subtask.id === taskId 
          ? { ...subtask, Progress: progress }
          : subtask
      )
    );
  };

  const handleMoveTask = (taskId: number, listId: number) => {
    console.log(`Moving task ${taskId} to list ${listId}`);
    setTasks(prev => 
      prev.map(task => 
        task.id === taskId 
          ? { ...task, task_list_id: listId }
          : task
      )
    );
  };

  const handleDeleteTask = (taskId: number) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
    setSubtasks(prev => prev.filter(subtask => subtask.id !== taskId));
  };

  const handleTimelineEdit = (taskId: number, start: Date, end: Date) => {
    console.log(`Updating timeline for task ${taskId}:`, { start, end });
  };

  // Handler for creating a new task list
  const handleCreateTaskList = () => {
    console.log(`Creating new task list: ${newTaskListName}`);
    setShowNewTaskListDialog(false);
    setNewTaskListName("");
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Task View</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New Task
        </Button>
      </div>

      <TaskFilters 
        searchQuery={searchQuery}
        progressFilter={progressFilter}
        sortBy={sortBy}
        showNewTaskListDialog={showNewTaskListDialog}
        showProjectModal={showProjectModal}
        newTaskListName={newTaskListName}
        onSearchChange={setSearchQuery}
        onProgressFilterChange={setProgressFilter}
        onSortByChange={setSortBy}
        onNewTaskListDialogChange={setShowNewTaskListDialog}
        onProjectModalChange={setShowProjectModal}
        onNewTaskListNameChange={setNewTaskListName}
        onCreateTaskList={handleCreateTaskList}
      />

      <div className="rounded-md border mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task Name</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map(task => (
              <React.Fragment key={task.id}>
                <TableRow className={task.Progress === "Completed" ? "bg-gray-50" : ""}>
                  <TaskNameCell
                    task={task}
                    subtasks={subtasks}
                    expandedTasks={expandedTasks}
                    editingTaskId={editingTaskId}
                    editingTaskName={editingTaskName}
                    taskLists={dummyTaskLists}
                    onToggleExpand={handleToggleExpand}
                    onEditNameChange={setEditingTaskName}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                    onUpdateProgress={(id, progress) => handleUpdateProgress(id, progress)}
                    onMoveTask={handleMoveTask}
                    onTimelineEdit={handleTimelineEdit}
                  />
                  <TaskProgressCell
                    task={task}
                    isEditing={editingTaskId === task.id}
                    onUpdateProgress={(progress) => handleUpdateProgress(task.id, progress)}
                  />
                  <TaskActionsCell
                    task={task}
                    isEditing={editingTaskId === task.id}
                    taskLists={dummyTaskLists}
                    onMoveTask={handleMoveTask}
                    onEditStart={handleEditStart}
                    onEditCancel={handleEditCancel}
                    onEditSave={handleEditSave}
                    onDeleteTask={handleDeleteTask}
                  />
                </TableRow>
                
                {expandedTasks.includes(task.id) && 
                  subtasks
                    .filter(subtask => subtask["Parent Task ID"] === task.id)
                    .map(subtask => (
                      <TableRow 
                        key={subtask.id} 
                        className="bg-gray-50/50"
                      >
                        <TableCell className="pl-10">
                          {editingTaskId === subtask.id ? (
                            <input
                              value={editingTaskName}
                              onChange={(e) => setEditingTaskName(e.target.value)}
                              className="w-full px-2 py-1 border rounded"
                            />
                          ) : (
                            subtask["Task Name"]
                          )}
                        </TableCell>
                        <TaskProgressCell
                          task={{
                            ...subtask,
                            task_list_id: null, // Add missing property for Task type
                            project_id: null,   // Add missing property for Task type
                          } as unknown as Task}
                          isEditing={editingTaskId === subtask.id}
                          onUpdateProgress={(progress) => handleUpdateProgress(subtask.id, progress)}
                        />
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {editingTaskId === subtask.id ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditSave(subtask.id)}
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
                              </>
                            ) : (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingTaskId(subtask.id);
                                    setEditingTaskName(subtask["Task Name"]);
                                  }}
                                >
                                  <PencilIcon className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteTask(subtask.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                }
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default TaskView;
