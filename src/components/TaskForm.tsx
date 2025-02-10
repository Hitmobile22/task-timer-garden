
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
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';

interface TaskFormProps {
  onTasksCreate: (tasks: string[]) => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ onTasksCreate }) => {
  const [numTasks, setNumTasks] = useState(1);
  const [taskInputs, setTaskInputs] = useState<string[]>(['']);

  const handleNumTasksChange = (value: string) => {
    const num = parseInt(value);
    setNumTasks(num);
    setTaskInputs(Array(num).fill(''));
  };

  const handleTaskInputChange = (index: number, value: string) => {
    const newInputs = [...taskInputs];
    newInputs[index] = value;
    setTaskInputs(newInputs);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskInputs.some(task => !task.trim())) {
      toast.error('Please fill in all task names');
      return;
    }
    onTasksCreate(taskInputs);
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

      <div className="space-y-4">
        {taskInputs.map((task, index) => (
          <div key={index} className="space-y-2">
            <Label htmlFor={`task-${index}`}>Task {index + 1} Name</Label>
            <Input
              id={`task-${index}`}
              value={task}
              onChange={(e) => handleTaskInputChange(index, e.target.value)}
              placeholder={`Enter task ${index + 1} name`}
              className="hover-lift"
              required
            />
          </div>
        ))}
      </div>

      <Button type="submit" className="w-full hover-lift">
        Create Tasks
      </Button>
    </form>
  );
};
