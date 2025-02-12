
import React from 'react';
import { Check } from 'lucide-react';

interface SubTask {
  name: string;
}

interface Task {
  name: string;
  subtasks: SubTask[];
}

interface TaskListProps {
  tasks: Task[];
}

export const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-4 animate-slideIn">
      <h2 className="text-lg font-semibold">Your Tasks</h2>
      <ul className="space-y-4">
        {tasks.map((task, taskIndex) => (
          <li key={taskIndex} className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-md bg-white/50 hover:bg-white/80 transition-colors">
              <span className="flex-shrink-0 h-6 w-6 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="h-4 w-4" />
              </span>
              <span className="flex-grow font-medium">{task.name}</span>
            </div>
            {task.subtasks.length > 0 && (
              <ul className="pl-8 space-y-2">
                {task.subtasks.map((subtask, subtaskIndex) => (
                  <li
                    key={subtaskIndex}
                    className="flex items-center gap-3 p-2 rounded-md bg-white/30 hover:bg-white/50 transition-colors"
                  >
                    <span className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="flex-grow text-sm">{subtask.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
