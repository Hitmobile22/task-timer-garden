
import React, { useState } from 'react';
import { Task, Subtask } from '@/types/task.types';
import { CheckCircle, Circle, ChevronDown, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';
import { getTaskListColor, extractSolidColorFromGradient } from '@/utils/taskUtils';
import { Button } from "@/components/ui/button";

interface TaskListProps {
  tasks: Task[];
  subtasks: Subtask[];
  onTaskStart: (taskId: number) => void;
  taskLists: any[];
  activeTaskId?: number;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  subtasks, 
  onTaskStart, 
  taskLists,
  activeTaskId 
}) => {
  const [expandedTasks, setExpandedTasks] = useState<number[]>([]);
  
  // Filter tasks to show only today's tasks
  const todayTasks = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // If it's after 9pm, include tasks until 5am
    const endTime = now.getHours() >= 21 
      ? (() => {
          const tomorrow5AM = new Date(tomorrow);
          tomorrow5AM.setHours(5, 0, 0, 0);
          return tomorrow5AM;
        })()
      : tomorrow;
    
    return tasks.filter(task => {
      const taskDate = task.date_started ? new Date(task.date_started) : null;
      return taskDate && taskDate >= today && taskDate < endTime;
    }).sort((a, b) => {
      const aTime = a.date_started ? new Date(a.date_started).getTime() : 0;
      const bTime = b.date_started ? new Date(b.date_started).getTime() : 0;
      return aTime - bTime;
    });
  }, [tasks]);
  
  const getFormattedTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'h:mm a');
    } catch (e) {
      return '';
    }
  };
  
  const toggleExpand = (taskId: number) => {
    setExpandedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId) 
        : [...prev, taskId]
    );
  };
  
  const getTaskClass = (task: Task) => {
    let classes = "flex items-center justify-between p-3 rounded-lg mb-2 hover:bg-gray-100 transition-colors";
    
    if (task.details && typeof task.details === 'object' && task.details.isTimeBlock === true) {
      classes += " bg-gray-200 hover:bg-gray-300";
    } else if (task.Progress === 'In progress') {
      classes += " bg-blue-50";
    }
    
    if (task.id === activeTaskId) {
      classes += " ring-2 ring-blue-400";
    }
    
    if (task.task_list_id && task.task_list_id !== 1) {
      const borderColor = extractSolidColorFromGradient(getTaskListColor(task.task_list_id, taskLists));
      classes += " border-l-4";
      // We'll set the border color in the style prop
    }
    
    return classes;
  };
  
  const getTaskStyle = (task: Task) => {
    if (task.task_list_id && task.task_list_id !== 1) {
      const borderColor = extractSolidColorFromGradient(getTaskListColor(task.task_list_id, taskLists));
      return { borderLeftColor: borderColor };
    }
    return {};
  };
  
  const getSubtasks = (taskId: number) => {
    return subtasks.filter(subtask => subtask["Parent Task ID"] === taskId);
  };
  
  if (todayTasks.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <p>No tasks scheduled for today.</p>
      </div>
    );
  }
  
  return (
    <div className="grid gap-4 px-[20px] py-[16px]">
      <h2 className="text-xl font-semibold">Today's Tasks</h2>
      <div className="space-y-1">
        {todayTasks.map((task) => {
          const hasSubtasks = getSubtasks(task.id).length > 0;
          const isTimeBlock = task.details && typeof task.details === 'object' && task.details.isTimeBlock === true;
          
          return (
            <div key={`task-${task.id}`}>
              <div
                className={getTaskClass(task)}
                style={getTaskStyle(task)}
              >
                <div className="flex items-center">
                  {hasSubtasks && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleExpand(task.id)}
                      className="mr-1 p-0 h-6 w-6"
                    >
                      {expandedTasks.includes(task.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  
                  {isTimeBlock ? (
                    <div className="w-6 h-6 mr-3 flex-shrink-0">
                      <Badge variant="outline" className="bg-gray-300 border-0">TB</Badge>
                    </div>
                  ) : task.Progress === 'In progress' ? (
                    <CheckCircle className="w-6 h-6 mr-3 text-blue-500" />
                  ) : (
                    <Circle 
                      className="w-6 h-6 mr-3 text-gray-400 cursor-pointer hover:text-gray-600" 
                      onClick={() => onTaskStart(task.id)}
                    />
                  )}
                  
                  <div>
                    <div className="font-medium">{task["Task Name"]}</div>
                    {task.date_started && (
                      <div className="text-xs text-gray-500">
                        {getFormattedTime(task.date_started)} - {task.date_due ? getFormattedTime(task.date_due) : 'Not set'}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {!isTimeBlock && (
                    <button 
                      onClick={() => onTaskStart(task.id)} 
                      className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-full transition-colors"
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
              
              {/* Show subtasks if expanded */}
              {expandedTasks.includes(task.id) && getSubtasks(task.id).length > 0 && (
                <div className="ml-8 mt-1 mb-2 space-y-1">
                  {getSubtasks(task.id).map(subtask => (
                    <div key={`subtask-${subtask.id}`} className="flex items-center p-2 rounded-lg hover:bg-gray-50">
                      <Circle className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-sm">{subtask["Task Name"]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
