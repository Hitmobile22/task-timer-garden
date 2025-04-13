
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronDown, Filter, Plus, Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Task } from '@/types/task.types';

interface TaskFiltersProps {
  searchQuery: string;
  progressFilter: Task['Progress'] | 'all';
  sortBy: 'date' | 'list' | 'project';
  showNewTaskListDialog: boolean;
  showProjectModal: boolean;
  newTaskListName: string;
  onSearchChange: (query: string) => void;
  onProgressFilterChange: (filter: Task['Progress'] | 'all') => void;
  onSortByChange: (sort: 'date' | 'list' | 'project') => void;
  onNewTaskListDialogChange: (open: boolean) => void;
  onProjectModalChange: (open: boolean) => void;
  onNewTaskListNameChange: (name: string) => void;
  onCreateTaskList: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  searchQuery,
  progressFilter,
  sortBy,
  showNewTaskListDialog,
  showProjectModal,
  newTaskListName,
  onSearchChange,
  onProgressFilterChange,
  onSortByChange,
  onNewTaskListDialogChange,
  onProjectModalChange,
  onNewTaskListNameChange,
  onCreateTaskList,
}) => {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <div className="relative flex-grow md:max-w-xs">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-8"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <Select value={progressFilter} onValueChange={(value: Task['Progress'] | 'all') => onProgressFilterChange(value)}>
        <SelectTrigger className="w-[160px]">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <SelectValue placeholder="Filter" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="Not started">Not started</SelectItem>
          <SelectItem value="In progress">In progress</SelectItem>
          <SelectItem value="Completed">Completed</SelectItem>
          <SelectItem value="Backlog">Backlog</SelectItem>
        </SelectContent>
      </Select>
      
      <Select value={sortBy} onValueChange={(value: 'date' | 'list' | 'project') => onSortByChange(value)}>
        <SelectTrigger className="w-[140px]">
          <div className="flex items-center gap-2">
            <ChevronDown className="h-4 w-4" />
            <SelectValue placeholder="Group by" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date">By Date</SelectItem>
          <SelectItem value="list">By List</SelectItem>
          <SelectItem value="project">By Project</SelectItem>
        </SelectContent>
      </Select>
      
      <Button
        variant="outline"
        onClick={() => onNewTaskListDialogChange(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        New List
      </Button>
      
      <Button
        onClick={() => onProjectModalChange(true)}
        className="flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        New Project
      </Button>
      
      <Dialog open={showNewTaskListDialog} onOpenChange={onNewTaskListDialogChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create a new task list</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="name" className="text-right">
                Name
              </label>
              <Input 
                id="name" 
                value={newTaskListName} 
                onChange={(e) => onNewTaskListNameChange(e.target.value)} 
                className="col-span-3" 
                placeholder="Enter list name"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTaskListName.trim()) {
                    onCreateTaskList();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onNewTaskListDialogChange(false)}>
              Cancel
            </Button>
            <Button type="submit" onClick={onCreateTaskList} disabled={!newTaskListName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
