
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronDown, Filter, Plus, Search, ListChecks, Upload, Archive, ArchiveRestore, Trash2 } from "lucide-react";
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
  onSubtaskPresetModalChange?: (open: boolean) => void;
  onCSVUploadModalChange?: (open: boolean) => void;
  onArchiveCompleted?: () => void;
  onToggleArchiveView?: () => void;
  showArchived?: boolean;
  onDeleteArchivedSubtasks?: () => void;
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
  onSubtaskPresetModalChange,
  onCSVUploadModalChange,
  onArchiveCompleted,
  onToggleArchiveView,
  showArchived,
  onDeleteArchivedSubtasks,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-4 w-full">
      {/* Left side - Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
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

        {onSubtaskPresetModalChange && (
          <Button
            variant="outline"
            onClick={() => onSubtaskPresetModalChange(true)}
            className="flex items-center gap-2"
          >
            <ListChecks className="h-4 w-4" />
            Subtask Presets
          </Button>
        )}

        {onArchiveCompleted && (
          <Button 
            variant="outline" 
            onClick={onArchiveCompleted}
            className="flex items-center gap-2 text-xs sm:text-sm"
            size="sm"
          >
            <Archive className="h-4 w-4" />
            <span className="hidden sm:inline">Archive</span>
            <span>Completed</span>
          </Button>
        )}

        {onToggleArchiveView && (
          <Button 
            variant={showArchived ? "default" : "outline"} 
            onClick={onToggleArchiveView}
            className="flex items-center gap-2 text-xs sm:text-sm"
            size="sm"
          >
            {showArchived ? (
              <>
                <ArchiveRestore className="h-4 w-4" />
                <span className="hidden sm:inline">Show</span>
                <span>Active</span>
              </>
            ) : (
              <>
                <Archive className="h-4 w-4" />
                <span className="hidden sm:inline">Show</span>
                <span>Archived</span>
              </>
            )}
          </Button>
        )}

        {showArchived && onDeleteArchivedSubtasks && (
          <Button 
            variant="outline" 
            onClick={onDeleteArchivedSubtasks}
            className="flex items-center gap-2 text-xs sm:text-sm"
            size="sm"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">Delete Archived</span>
            <span>Subtasks</span>
          </Button>
        )}

        {onCSVUploadModalChange && (
          <Button
            variant="outline"
            onClick={() => onCSVUploadModalChange(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </Button>
        )}
      </div>

      {/* Right side - Search and filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-8 w-[180px]"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        
        <Select value={progressFilter} onValueChange={(value: Task['Progress'] | 'all') => onProgressFilterChange(value)}>
          <SelectTrigger className="w-[140px]">
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
          <SelectTrigger className="w-[120px]">
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
      </div>
      
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
