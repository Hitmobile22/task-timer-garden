
import React from 'react';
import { MenuBar } from "@/components/MenuBar";
import { TaskViewHeader } from "@/components/task/TaskViewHeader";
import { TaskViewContent } from "@/components/task/TaskViewContent";
import { ProjectDialog } from '@/components/task/ProjectDialog';
import { useTaskView } from '@/hooks/useTaskView';

export function TaskView() {
  const {
    state,
    handlers,
    queries,
    mutations
  } = useTaskView();

  return (
    <div 
      className="min-h-screen p-6 space-y-8 animate-fadeIn"
      style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #003366 50%, #004080 100%)',
      }}
    >
      <div className="container mx-auto max-w-7xl">
        <MenuBar />
      </div>
      
      <main className="container mx-auto max-w-7xl space-y-8">
        <TaskViewHeader />
        
        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
          <TaskViewContent 
            state={state}
            handlers={handlers}
            queries={queries}
            mutations={mutations}
          />
        </div>
      </main>

      <ProjectDialog
        open={state.showProjectDialog}
        onOpenChange={handlers.setShowProjectDialog}
        onCreateProject={handlers.handleCreateProject}
      />
    </div>
  );
}

export default TaskView;
