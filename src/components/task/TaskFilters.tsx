
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, ArrowUpDown, Plus } from "lucide-react";
import { Task } from '@/types/task.types';
import { useIsMobile } from '@/hooks/use-mobile';
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
  progressFilter: Task['Progress'] | "all";
  sortBy: 'date' | 'list' | 'project';
  showNewTaskListDialog: boolean;
  showProjectModal: boolean;
  newTaskListName: string;
  onSearchChange: (value: string) => void;
  onProgressFilterChange: (value: Task['Progress'] | "all") => void;
  onSortByChange: (value: 'date' | 'list' | 'project') => void;
  onNewTaskListDialogChange: (open: boolean) => void;
  onProjectModalChange: (open: boolean) => void;
  onNewTaskListNameChange: (value: string) => void;
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
  const isMobile = useIsMobile();

  return (
    <div className="w-full space-y-4">
      <div className={`flex flex-wrap gap-4 ${isMobile ? 'flex-col' : 'items-center justify-between'}`}>
        <div className={`${isMobile ? 'w-full' : 'flex-1 min-w-[200px] max-w-sm'}`}>
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>
        <div className={`flex ${isMobile ? 'flex-wrap w-full justify-between' : 'items-center'} gap-2`}>
          <div className="flex items-center gap-2">
            <Dialog open={showNewTaskListDialog} onOpenChange={onNewTaskListDialogChange}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="flex-shrink-0">
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

            <Button 
              variant="outline" 
              size="icon"
              onClick={() => onProjectModalChange(true)}
              className="flex-shrink-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className={`flex ${isMobile ? 'w-full mt-2 justify-between' : 'items-center'} gap-2`}>
            <Select
              value={progressFilter}
              onValueChange={(value: Task['Progress'] | "all") => onProgressFilterChange(value)}
            >
              <SelectTrigger className={`${isMobile ? 'w-full' : 'w-[180px]'}`}>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 flex-shrink-0" />
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
            
            <Select
              value={sortBy}
              onValueChange={(value: 'date' | 'list' | 'project') => onSortByChange(value)}
            >
              <SelectTrigger className={`${isMobile ? 'w-full' : 'w-[180px]'}`}>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 flex-shrink-0" />
                  <SelectValue placeholder="Sort by" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="list">Sort by List</SelectItem>
                <SelectItem value="project">Sort by Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
