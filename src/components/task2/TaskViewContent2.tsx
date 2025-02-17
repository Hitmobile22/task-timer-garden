
import React from 'react';
import { TaskFilters2 } from './TaskFilters2';
import { TaskList2 } from './TaskList2';
import { Button } from "@/components/ui/button";
import { GoogleCalendarIntegration } from '../task/GoogleCalendarIntegration';
import { PencilIcon, ListFilter, Folders } from "lucide-react";
import { DndContext, closestCenter } from '@dnd-kit/core';

export const TaskViewContent2 = ({ state, handlers, queries, mutations }) => {
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <TaskFilters2
          searchQuery={state.searchQuery}
          progressFilter={state.progressFilter}
          sortBy={state.sortBy}
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
        <TaskList2
          state={state}
          handlers={handlers}
          queries={queries}
          mutations={mutations}
        />
      </DndContext>
    </>
  );
};
