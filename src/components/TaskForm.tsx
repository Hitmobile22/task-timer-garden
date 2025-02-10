
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';

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
    <form onSubmit={handleSubmit} className="space-y-6 glass p-6 rounded-lg shadow-sm animate-slideIn">
      <div className="space-y-2">
        <Label htmlFor="numTasks">Number of Tasks</Label>
        <Select
          defaultValue="1"
          onValueChange={handleNumTasksChange}
        >
          {[...Array(10)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} {i === 0 ? 'Task' : 'Tasks'}
            </option>
          ))}
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
