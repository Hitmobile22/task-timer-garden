
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Task } from '@/types/task.types';
import { Filter, ArrowUpDown, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface TaskFiltersProps {
  searchQuery: string;
  progressFilter: Task['Progress'][];
  sortBy: 'date' | 'list';
  showNewTaskListDialog: boolean;
  newTaskListName: string;
  onSearchChange: (value: string) => void;
  onProgressFilterChange: (value: Task['Progress']) => void;
  onSortByChange: (value: 'date' | 'list') => void;
  onNewTaskListDialogChange: (open: boolean) => void;
  onNewTaskListNameChange: (value: string) => void;
  onCreateTaskList: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  searchQuery,
  progressFilter,
  sortBy,
  showNewTaskListDialog,
  newTaskListName = '', // Provide default value to prevent trim() of undefined
  onSearchChange,
  onProgressFilterChange,
  onSortByChange,
  onNewTaskListDialogChange,
  onNewTaskListNameChange,
  onCreateTaskList,
}) => {
  const statuses: Task['Progress'][] = ["Not started", "In progress", "Completed", "Backlog"];

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {statuses.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <Checkbox
                  id={status}
                  checked={progressFilter.includes(status)}
                  onCheckedChange={() => onProgressFilterChange(status)}
                />
                <label htmlFor={status} className="text-sm font-medium">
                  {status}
                </label>
              </div>
            ))}
          </div>
          <Dialog open={showNewTaskListDialog} onOpenChange={onNewTaskListDialogChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Task List</DialogTitle>
                <DialogDescription>
                  Enter a name for your new task list.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Task List Name"
                  value={newTaskListName}
                  onChange={(e) => onNewTaskListNameChange(e.target.value)}
                />
                <Button 
                  onClick={onCreateTaskList}
                  disabled={!newTaskListName.trim()}
                >
                  Create List
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};
