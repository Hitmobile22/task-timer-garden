
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Task } from '@/types/task.types';
import { Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface TaskFilters2Props {
  searchQuery: string;
  progressFilter: Task['Progress'][];
  sortBy: 'date' | 'list';
  onSearchChange: (value: string) => void;
  onProgressFilterChange: (value: Task['Progress']) => void;
  onSortByChange: (value: 'date' | 'list') => void;
}

export const TaskFilters2: React.FC<TaskFilters2Props> = ({
  searchQuery,
  progressFilter,
  sortBy,
  onSearchChange,
  onProgressFilterChange,
  onSortByChange,
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
        </div>
      </div>
    </div>
  );
};
