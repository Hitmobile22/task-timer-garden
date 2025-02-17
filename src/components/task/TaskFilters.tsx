
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, ArrowUpDown, Plus } from "lucide-react";
import { Task } from '@/types/task.types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskFiltersProps {
  searchQuery: string;
  progressFilter: Task['Progress'] | "all";
  sortBy: 'date' | 'list';
  showNewTaskListDialog: boolean;
  newTaskListName: string;
  onSearchChange: (value: string) => void;
  onProgressFilterChange: (value: Task['Progress'] | "all") => void;
  onSortByChange: (value: 'date' | 'list') => void;
  onNewTaskListDialogChange: (open: boolean) => void;
  onNewTaskListNameChange: (value: string) => void;
  onCreateTaskList: () => void;
  onCreateProject?: () => void;
}

export const TaskFilters: React.FC<TaskFiltersProps> = ({
  searchQuery,
  progressFilter,
  sortBy,
  showNewTaskListDialog,
  newTaskListName,
  onSearchChange,
  onProgressFilterChange,
  onSortByChange,
  onNewTaskListDialogChange,
  onNewTaskListNameChange,
  onCreateTaskList,
  onCreateProject,
}) => {
  const [showNewProjectDialog, setShowNewProjectDialog] = React.useState(false);
  const [newProjectName, setNewProjectName] = React.useState("");

  return (
    <div className="flex flex-wrap gap-4 items-center justify-between w-full">
      <div className="flex items-center gap-4 flex-1">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Status Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            {['Not started', 'In progress', 'Completed', 'Backlog'].map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={progressFilter === status}
                onCheckedChange={() => onProgressFilterChange(status as Task['Progress'])}
              >
                {status}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select
          value={sortBy}
          onValueChange={(value: 'date' | 'list') => onSortByChange(value)}
        >
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="list">Sort by List</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          onClick={() => setShowNewProjectDialog(true)}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </Button>
      </div>

      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter a name for your new project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Project Name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                onCreateProject?.();
                setShowNewProjectDialog(false);
                setNewProjectName("");
              }}
              disabled={!newProjectName.trim()}
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
