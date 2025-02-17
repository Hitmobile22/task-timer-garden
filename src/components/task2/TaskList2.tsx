
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Task, Subtask } from '@/types/task.types';
import { Checkbox } from "@/components/ui/checkbox";

interface TaskList2Props {
  state: {
    editingTaskId: number | null;
    editingTaskName: string;
    expandedTasks: number[];
    bulkMode: boolean;
    selectedTasks: number[];
    showArchived: boolean;
  };
  handlers: {
    handleToggleExpand: (taskId: number) => void;
    setSelectedTasks: (tasks: number[]) => void;
  };
  queries: {
    tasks: Task[] | null;
    subtasks: Subtask[] | null;
    isLoading: boolean;
  };
}

export const TaskList2: React.FC<TaskList2Props> = ({
  state,
  handlers,
  queries,
}) => {
  if (queries.isLoading) {
    return <div>Loading tasks...</div>;
  }

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            {state.bulkMode && (
              <TableHead className="w-[50px]">Select</TableHead>
            )}
            <TableHead>Task Name</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Timeline</TableHead>
            <TableHead className="w-[200px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {queries.tasks?.filter(task => state.showArchived || !task.archived)
            .map((task) => (
              <TableRow key={task.id}>
                {state.bulkMode && (
                  <TableCell>
                    <Checkbox
                      checked={state.selectedTasks.includes(task.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handlers.setSelectedTasks([...state.selectedTasks, task.id]);
                        } else {
                          handlers.setSelectedTasks(state.selectedTasks.filter(id => id !== task.id));
                        }
                      }}
                    />
                  </TableCell>
                )}
                <TableCell>{task["Task Name"]}</TableCell>
                <TableCell>{task.Progress}</TableCell>
                <TableCell>
                  {task.date_started && new Date(task.date_started).toLocaleDateString()}
                  {task.date_due && ` - ${new Date(task.date_due).toLocaleDateString()}`}
                </TableCell>
                <TableCell>
                  {/* Actions will be implemented in the next iteration */}
                  <div className="flex gap-2">
                    <span>Actions coming soon...</span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
};
