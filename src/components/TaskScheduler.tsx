
import React, { useState } from 'react';
import { TaskForm } from './TaskForm';
import { TaskList } from './TaskList';
import { PomodoroTimer } from './PomodoroTimer';
import { MenuBar } from './MenuBar';
import { Button } from './ui/button';
import { MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SubTask {
  name: string;
}

interface Task {
  name: string;
  subtasks: SubTask[];
}

export const TaskScheduler = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showTimer, setShowTimer] = useState(false);
  const navigate = useNavigate();

  const handleTasksCreate = (newTasks: Task[]) => {
    setTasks(newTasks);
    setShowTimer(true);
  };

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #9b87f5 0%, #7E69AB 50%, #6E59A5 100%)',
      }}
    >
      <div className="container mx-auto max-w-4xl flex justify-between items-center">
        <MenuBar />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate('/tasks')}>
              Task View
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <main className="container mx-auto max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-white">Task Scheduler</h1>
          <p className="text-white/80">Organize your time, maximize your productivity</p>
        </header>

        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
          <div className="grid gap-8 md:grid-cols-[1fr,auto] items-start">
            <div className="space-y-6">
              <TaskForm onTasksCreate={handleTasksCreate} />
              <TaskList tasks={tasks} />
            </div>
            
            {showTimer && (
              <div className="w-full md:w-[350px] animate-slideIn">
                <PomodoroTimer tasks={tasks.map(t => t.name)} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
