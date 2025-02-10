
import React, { useState } from 'react';
import { TaskForm } from './TaskForm';
import { PomodoroTimer } from './PomodoroTimer';
import { MenuBar } from './MenuBar';
import { TaskList } from './TaskList';

export const TaskScheduler = () => {
  const [tasks, setTasks] = useState<string[]>([]);

  const handleTasksCreate = (newTasks: string[]) => {
    setTasks(newTasks);
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-8 animate-fadeIn">
      <MenuBar />
      
      <main className="container mx-auto max-w-4xl space-y-8">
        <header className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Task Scheduler</h1>
          <p className="text-muted-foreground">Organize your time, maximize your productivity</p>
        </header>

        <div className="grid gap-8 md:grid-cols-[1fr,auto] items-start">
          <div className="space-y-6">
            <TaskForm onTasksCreate={handleTasksCreate} />
            <TaskList tasks={tasks} />
          </div>
          
          <div className="w-full md:w-[350px]">
            <PomodoroTimer tasks={tasks} />
          </div>
        </div>
      </main>
    </div>
  );
};
