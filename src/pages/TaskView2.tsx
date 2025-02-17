
import React from 'react';
import { MenuBar } from "@/components/MenuBar";
import { TaskList2 } from "@/components/task2/TaskList2";
import { ProjectDialog } from '@/components/task/ProjectDialog';
import { useTaskView2 } from '@/hooks/useTaskView2';
import { TaskViewHeader2 } from "@/components/task2/TaskViewHeader2";
import { TaskViewContent2 } from "@/components/task2/TaskViewContent2";

export function TaskView2() {
  const {
    state,
    handlers,
    queries,
    mutations
  } = useTaskView2();

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
        <TaskViewHeader2 />
        
        <div className="glass bg-white/90 backdrop-blur-lg rounded-xl p-8 shadow-lg">
          <TaskViewContent2 
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

export default TaskView2;
