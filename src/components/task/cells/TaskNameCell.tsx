
import React from 'react';
import { TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronRight, PencilLine } from "lucide-react";
import { Task, Subtask } from '@/types/task.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface TaskNameCellProps {
  task: Task;
  subtasks?: Subtask[];
  expandedTasks: number[];
  editingTaskId: number | null;
  editingTaskName: string;
  onToggleExpand: (taskId: number) => void;
  onEditNameChange: (value: string) => void;
  onEditSave: (taskId: number) => void;
  onEditCancel: () => void;
}

export const TaskNameCell: React.FC<TaskNameCellProps> = ({
  task,
  subtasks,
  expandedTasks,
  editingTaskId,
  editingTaskName,
  onToggleExpand,
  onEditNameChange,
  onEditSave,
  onEditCancel,
}) => {
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [tempTaskName, setTempTaskName] = React.useState(task["Task Name"]);

  const handleEditSubmit = () => {
    onEditNameChange(tempTaskName);
    onEditSave(task.id);
    setShowEditModal(false);
  };

  return (
    <TableCell className="font-medium">
      <div className="flex items-center gap-2">
        {subtasks?.some(st => st["Parent Task ID"] === task.id) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0"
            onClick={() => onToggleExpand(task.id)}
          >
            {expandedTasks.includes(task.id) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}
        {editingTaskId === task.id ? (
          <div className="flex items-center gap-2 flex-grow">
            <Input
              value={editingTaskName}
              onChange={(e) => onEditNameChange(e.target.value)}
              className="w-full"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between flex-grow">
            <span>{task["Task Name"]}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
              onClick={() => {
                setTempTaskName(task["Task Name"]);
                setShowEditModal(true);
              }}
            >
              <PencilLine className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-name">Task Name</Label>
              <Input
                id="task-name"
                value={tempTaskName}
                onChange={(e) => setTempTaskName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleEditSubmit}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TableCell>
  );
};
