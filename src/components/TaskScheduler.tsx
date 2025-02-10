
import React, { useState } from 'react';
import { TaskForm } from './TaskForm';
import { PomodoroTimer } from './PomodoroTimer';
import { MenuBar } from './MenuBar';
import { TaskList } from './TaskList';

export const TaskScheduler = () => {
  const [tasks, setTasks] = useState<string[]>([]);
  const [showTimer, setShowTimer] = useState(false);

  const handleTasksCreate = (newTasks: string[]) => {
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
      <MenuBar />
      
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
                <PomodoroTimer tasks={tasks} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
