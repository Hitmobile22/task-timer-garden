
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';

interface SubTask {
  name: string;
}

interface Task {
  name: string;
  subtasks: SubTask[];
}

interface TaskFormProps {
  onTasksCreate: (tasks: Task[]) => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ onTasksCreate }) => {
  const [numTasks, setNumTasks] = useState(1);
  const [tasks, setTasks] = useState<Task[]>([{ name: '', subtasks: [] }]);

  const handleNumTasksChange = (value: string) => {
    const num = parseInt(value);
    setNumTasks(num);
    setTasks(Array(num).fill(null).map(() => ({ name: '', subtasks: [] })));
  };

  const handleTaskInputChange = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index].name = value;
    setTasks(newTasks);
  };

  const addSubtask = (taskIndex: number) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks.push({ name: '' });
    setTasks(newTasks);
  };

  const removeSubtask = (taskIndex: number, subtaskIndex: number) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks.splice(subtaskIndex, 1);
    setTasks(newTasks);
  };

  const handleSubtaskInputChange = (taskIndex: number, subtaskIndex: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks[subtaskIndex].name = value;
    setTasks(newTasks);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tasks.some(task => !task.name.trim())) {
      toast.error('Please fill in all task names');
      return;
    }
    if (tasks.some(task => task.subtasks.some(subtask => !subtask.name.trim()))) {
      toast.error('Please fill in all subtask names');
      return;
    }
    onTasksCreate(tasks);
    toast.success('Tasks created successfully');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="numTasks">Number of Tasks</Label>
        <Select
          value={numTasks.toString()}
          onValueChange={handleNumTasksChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select number of tasks" />
          </SelectTrigger>
          <SelectContent>
            {[...Array(10)].map((_, i) => (
              <SelectItem key={i + 1} value={(i + 1).toString()}>
                {i + 1} {i === 0 ? 'Task' : 'Tasks'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-6">
        {tasks.map((task, taskIndex) => (
          <div key={taskIndex} className="space-y-4 p-4 rounded-lg bg-white/50">
            <div className="space-y-2">
              <Label htmlFor={`task-${taskIndex}`}>Task {taskIndex + 1} Name</Label>
              <Input
                id={`task-${taskIndex}`}
                value={task.name}
                onChange={(e) => handleTaskInputChange(taskIndex, e.target.value)}
                placeholder={`Enter task ${taskIndex + 1} name`}
                className="hover-lift"
                required
              />
            </div>

            <div className="space-y-3 pl-4 border-l-2 border-primary/20">
              {task.subtasks.map((subtask, subtaskIndex) => (
                <div key={subtaskIndex} className="flex items-center gap-2">
                  <Input
                    value={subtask.name}
                    onChange={(e) => handleSubtaskInputChange(taskIndex, subtaskIndex, e.target.value)}
                    placeholder={`Enter subtask ${subtaskIndex + 1} name`}
                    className="hover-lift"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSubtask(taskIndex, subtaskIndex)}
                    className="flex-shrink-0"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => addSubtask(taskIndex)}
                className="text-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Subtask
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full hover-lift">
        Create Tasks
      </Button>
    </form>
  );
};
