
import React from 'react';
import { Check } from 'lucide-react';

interface TaskListProps {
  tasks: string[];
}

export const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-4 animate-slideIn">
      <h2 className="text-lg font-semibold">Your Tasks</h2>
      <ul className="space-y-2">
        {tasks.map((task, index) => (
          <li
            key={index}
            className="flex items-center gap-3 p-3 rounded-md bg-white/50 hover:bg-white/80 transition-colors"
          >
            <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-4 w-4" />
            </span>
            <span className="flex-grow">{task}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
