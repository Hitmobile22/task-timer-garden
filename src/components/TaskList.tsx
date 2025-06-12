
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Play, Clock, Calendar } from "lucide-react";
import { format } from 'date-fns';
import { Task } from '@/types/task.types';
import { useNavigate } from 'react-router-dom';
import { TaskEditModal } from './task/TaskEditModal';

interface TaskListProps {
  tasks: Task[];
  onTaskStart?: (taskId: number) => void;
  subtasks?: any[];
  taskLists?: any[];
  activeTaskId?: number;
}

export const TaskList: React.FC<TaskListProps> = ({ 
  tasks, 
  onTaskStart, 
  subtasks = [], 
  taskLists = [], 
  activeTaskId 
}) => {
  const navigate = useNavigate();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  console.log('TaskList: Received tasks:', tasks.length);
  console.log('TaskList: Tasks data:', tasks.map(t => ({ 
    id: t.id, 
    name: t["Task Name"], 
    progress: t.Progress, 
    start: t.date_started 
  })));

  // Query for all tasks to get today's tasks
  const { data: dbTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Tasks')
        .select('*')
        .order('date_started', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Get subtasks for all tasks
  const { data: allSubtasks } = useQuery({
    queryKey: ['subtasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
  });

  const getTodayTasks = (tasks: Task[]) => {
    if (!tasks || tasks.length === 0) return [];
    
    console.log('TaskList getTodayTasks: Processing', tasks.length, 'tasks');
    
    // Filter for active tasks (not completed or backlog)
    const activeTasks = tasks.filter(task => 
      task.Progress !== 'Completed' && task.Progress !== 'Backlog'
    );
    
    console.log('TaskList getTodayTasks: Active tasks:', activeTasks.length);
    
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const tomorrow3AM = new Date(tomorrow);
    tomorrow3AM.setHours(3, 0, 0, 0);
    
    // Filter for today's tasks using time zone logic
    let todayTasks;
    if (now.getHours() >= 21 || now.getHours() < 3) {
      // Between 9 PM and 3 AM, show tasks until 3 AM tomorrow
      todayTasks = activeTasks.filter(task => {
        if (!task.date_started) return false;
        
        const taskDate = new Date(task.date_started);
        const isInRange = taskDate >= today && taskDate <= tomorrow3AM;
        
        console.log('TaskList getTodayTasks (evening): Task', task["Task Name"], 'scheduled for', taskDate.toISOString(), 'isInRange:', isInRange);
        
        return isInRange;
      });
    } else {
      // Regular hours: show tasks for today only
      todayTasks = activeTasks.filter(task => {
        if (!task.date_started) return false;
        
        const taskDate = new Date(task.date_started);
        const isToday = taskDate >= today && taskDate < tomorrow;
        
        console.log('TaskList getTodayTasks (regular): Task', task["Task Name"], 'scheduled for', taskDate.toISOString(), 'isToday:', isToday);
        
        return isToday;
      });
    }
    
    console.log('TaskList getTodayTasks: Final today tasks:', todayTasks.length);
    
    return todayTasks.sort((a, b) => {
      const aDate = a.date_started ? new Date(a.date_started) : new Date(0);
      const bDate = b.date_started ? new Date(b.date_started) : new Date(0);
      return aDate.getTime() - bDate.getTime();
    });
  };

  const todayTasks = getTodayTasks(dbTasks || []);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    return format(new Date(dateString), 'h:mm a');
  };

  const getTaskListColor = (taskListId: number | null) => {
    if (!taskListId || !taskLists) return '#6b7280';
    const taskList = taskLists.find(list => list.id === taskListId);
    return taskList?.color || '#6b7280';
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setShowEditModal(true);
  };

  const getProgressBadgeColor = (progress: string) => {
    switch (progress) {
      case 'Completed':
        return 'bg-green-100 text-green-800';
      case 'In progress':
        return 'bg-blue-100 text-blue-800';
      case 'Not started':
        return 'bg-gray-100 text-gray-800';
      case 'Backlog':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Today's Tasks</h2>
        <Button
          variant="outline"
          onClick={() => navigate('/tasks')}
          className="flex items-center gap-2"
        >
          View All Tasks
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {todayTasks.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">No tasks scheduled for today</p>
              <p className="text-sm">Create some tasks to get started!</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {todayTasks.map((task) => {
            const taskSubtasks = allSubtasks?.filter(st => st["Parent Task ID"] === task.id) || [];
            const isActive = activeTaskId === task.id;
            
            return (
              <Card 
                key={task.id} 
                className={`transition-all duration-200 hover:shadow-md cursor-pointer ${
                  isActive ? 'ring-2 ring-blue-500 shadow-lg' : ''
                }`}
                onClick={() => handleTaskClick(task)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-1 h-8 rounded-full"
                        style={{ backgroundColor: getTaskListColor(task.task_list_id) }}
                      />
                      <div>
                        <CardTitle className="text-base font-medium">
                          {task["Task Name"]}
                        </CardTitle>
                        {task.date_started && (
                          <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(task.date_started)}
                            {task.date_due && (
                              <span> - {formatTime(task.date_due)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getProgressBadgeColor(task.Progress || '')}>
                        {task.Progress}
                      </Badge>
                      {onTaskStart && task.Progress !== 'Completed' && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskStart(task.id);
                          }}
                          className="flex items-center gap-1"
                        >
                          <Play className="h-3 w-3" />
                          Start
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                {taskSubtasks.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-600 mb-2">
                        Subtasks ({taskSubtasks.filter(st => st.Progress === 'Completed').length}/{taskSubtasks.length} completed)
                      </p>
                      {taskSubtasks.slice(0, 3).map((subtask) => (
                        <div key={subtask.id} className="flex items-center gap-2 text-sm">
                          <div className={`w-2 h-2 rounded-full ${
                            subtask.Progress === 'Completed' ? 'bg-green-500' : 'bg-gray-300'
                          }`} />
                          <span className={subtask.Progress === 'Completed' ? 'line-through text-gray-500' : ''}>
                            {subtask["Task Name"]}
                          </span>
                        </div>
                      ))}
                      {taskSubtasks.length > 3 && (
                        <p className="text-xs text-gray-500 pl-4">
                          +{taskSubtasks.length - 3} more subtasks
                        </p>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <TaskEditModal
        task={selectedTask}
        open={showEditModal}
        onOpenChange={setShowEditModal}
        taskLists={taskLists}
      />
    </div>
  );
};
