
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { fetchSubtasksFromAI } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
type Status = Database['public']['Enums']['status'];
interface SubTask {
  name: string;
}
interface Task {
  name: string;
  subtasks: SubTask[];
}
export const TaskForm = ({
  onTasksCreate
}) => {
  const {
    data: taskLists
  } = useQuery({
    queryKey: ['task-lists'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('TaskLists').select('*').order('order', {
        ascending: true
      });
      if (error) throw error;
      return data;
    }
  });
  const [numTasks, setNumTasks] = useState<string>("1");
  const [tasks, setTasks] = useState<Task[]>([{
    name: "",
    subtasks: []
  }]);
  const [loadingTaskIndex, setLoadingTaskIndex] = useState<number | null>(null);
  const [delayType, setDelayType] = useState<'minutes' | 'datetime' | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedMinutes, setSelectedMinutes] = useState<string>('');
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const handleNumTasksChange = (value: string) => {
    setNumTasks(value);
    const numericValue = parseInt(value);
    const newTasks = Array(numericValue).fill(null).map((_, i) => ({
      name: tasks[i]?.name || "",
      subtasks: tasks[i]?.subtasks || []
    }));
    setTasks(newTasks);
  };
  
  const handleTaskInputChange = (index: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[index].name = value;
    setTasks(newTasks);
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
    }
    typingTimeout.current = setTimeout(async () => {
      if (value.startsWith("@i ")) {
        const taskName = value.substring(3).trim();
        if (taskName.length > 0) {
          setLoadingTaskIndex(index);
          try {
            const aiSubtasks = await fetchSubtasksFromAI(taskName);
            newTasks[index].subtasks = aiSubtasks.map(subtask => ({
              name: subtask
            }));
            setTasks([...newTasks]);
          } catch (error) {
            console.error("Error fetching AI subtasks:", error);
          }
          setLoadingTaskIndex(null);
        }
      }
    }, 1000);
  };
  
  useEffect(() => {
    return () => {
      if (typingTimeout.current) {
        clearTimeout(typingTimeout.current);
      }
    };
  }, []);
  
  const addSubtask = (taskIndex: number) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks.push({
      name: ""
    });
    setTasks(newTasks);
  };
  
  const removeSubtask = (taskIndex: number, subtaskIndex: number) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks.splice(subtaskIndex, 1);
    setTasks(newTasks);
  };
  
  const handleSubtaskInputChange = (taskIndex: number, subtaskIndex: number, value: string) => {
    const newTasks = [...tasks];
    newTasks[taskIndex].subtasks[subtaskIndex].name = value;
    setTasks(newTasks);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tasks.some(task => !task.name.trim())) {
      toast.error("Please fill in all task names");
      return;
    }
    if (tasks.some(task => task.subtasks.some(subtask => !subtask.name.trim()))) {
      toast.error("Please fill in all subtask names");
      return;
    }
    try {
      const currentTime = new Date();
      let delayMilliseconds = 0;
      if (delayType === 'minutes' && selectedMinutes) {
        delayMilliseconds = parseInt(selectedMinutes) * 60 * 1000;
      } else if (delayType === 'datetime' && selectedDate) {
        delayMilliseconds = selectedDate.getTime() - currentTime.getTime();
        if (delayMilliseconds < 0) {
          toast.error("Selected time is in the past");
          return;
        }
      }
      
      // Get all time blocks to avoid scheduling tasks during them
      const { data: timeBlocks } = await supabase
        .from('Tasks')
        .select('*')
        .eq('Progress', 'Backlog')
        .gte('date_due', currentTime.toISOString())
        .order('date_started', { ascending: true });
      
      // Filter to include only time blocks
      const timeBlockItems = (timeBlocks || []).filter(task => 
        task.details && 
        typeof task.details === 'object' && 
        'isTimeBlock' in task.details && 
        task.details.isTimeBlock === true
      );
      
      let startTime = new Date(currentTime.getTime() + delayMilliseconds);
      const createdTasks = [];
      
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        // Find a suitable start time that doesn't overlap with time blocks
        let taskStartTime = new Date(startTime);
        let taskDueTime = new Date(taskStartTime.getTime() + 25 * 60 * 1000);
        let foundValidTime = false;
        
        while (!foundValidTime) {
          foundValidTime = true;
          
          // Check for conflicts with time blocks
          if (timeBlockItems && timeBlockItems.length > 0) {
            for (const block of timeBlockItems) {
              const blockStart = new Date(block.date_started);
              const blockEnd = new Date(block.date_due);
              
              // Check for overlap
              if (
                (taskStartTime >= blockStart && taskStartTime < blockEnd) || // task starts during block
                (taskDueTime > blockStart && taskDueTime <= blockEnd) || // task ends during block
                (taskStartTime <= blockStart && taskDueTime >= blockEnd) // task spans the entire block
              ) {
                // Schedule task after this time block
                taskStartTime = new Date(blockEnd.getTime() + 5 * 60 * 1000);
                taskDueTime = new Date(taskStartTime.getTime() + 25 * 60 * 1000);
                foundValidTime = false;
                break;
              }
            }
          }
        }
        
        // Create main task with timestamps and delay info
        const {
          data: taskData,
          error: taskError
        } = await supabase.from('Tasks').insert([{
          "Task Name": task.name,
          "Progress": "Not started" as Status,
          "date_started": taskStartTime.toISOString(),
          "date_due": taskDueTime.toISOString(),
          "delay_type": delayType,
          "delay_value": delayType === 'minutes' ? selectedMinutes : selectedDate?.toISOString()
        }]).select().single();
        
        if (taskError) throw taskError;
        createdTasks.push(taskData);

        // Create subtasks
        if (task.subtasks.length > 0) {
          const subtasksToInsert = task.subtasks.map(subtask => ({
            "Task Name": subtask.name,
            "Progress": "Not started" as Status,
            "Parent Task ID": taskData.id
          }));
          const {
            error: subtaskError
          } = await supabase.from('subtasks').insert(subtasksToInsert);
          if (subtaskError) throw subtaskError;
        }
        
        // Set start time for next task
        startTime = new Date(taskDueTime.getTime() + 5 * 60 * 1000);
      }

      // Reset form state
      setTasks([{
        name: "",
        subtasks: []
      }]);
      setNumTasks("1");
      setDelayType(null);
      setSelectedDate(undefined);
      setSelectedMinutes('');
      onTasksCreate(tasks);
    } catch (error) {
      console.error('Error creating tasks:', error);
      toast.error('Failed to create tasks');
    }
  };
  
  return <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4 px-[20px]">
        <div className="px-[58px]">
          <Label htmlFor="numTasks">Number of Tasks</Label>
          <Select value={numTasks} onValueChange={handleNumTasksChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select number of tasks" />
            </SelectTrigger>
            <SelectContent>
              {[...Array(10)].map((_, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>
                  {i + 1} {i === 0 ? "Task" : "Tasks"}
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Delay by Minutes</Label>
            <Select value={delayType === 'minutes' ? selectedMinutes : ''} onValueChange={value => {
              if (value === 'none') {
                setDelayType(null);
                setSelectedMinutes('');
              } else {
                setDelayType('minutes');
                setSelectedMinutes(value);
                setSelectedDate(undefined);
              }
            }} disabled={delayType === 'datetime'}>
              <SelectTrigger>
                <SelectValue placeholder="Select delay" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {[5, 10, 25, 30, 45, 60, 120, 180].map(minutes => <SelectItem key={minutes} value={minutes.toString()}>
                    {minutes >= 60 ? `${minutes / 60} ${minutes === 60 ? 'hour' : 'hours'}` : `${minutes} minutes`}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Schedule for</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")} disabled={delayType === 'minutes'} onClick={() => {
                  if (delayType !== 'datetime') {
                    setDelayType('datetime');
                    setSelectedMinutes('');
                  }
                }}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP p") : <span>Pick date and time</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0" 
                align="start"
                onInteractOutside={(e) => e.preventDefault()}
                onFocusOutside={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                <div 
                  className="p-4 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <Calendar mode="single" selected={selectedDate} onSelect={date => {
                    if (date) {
                      const currentTime = selectedDate || new Date();
                      date.setHours(currentTime.getHours());
                      date.setMinutes(currentTime.getMinutes());
                      setSelectedDate(date);
                    }
                  }} initialFocus />
                  <div className="flex gap-2 items-center">
                    <Input 
                      type="time" 
                      value={selectedDate ? format(selectedDate, "HH:mm") : ""} 
                      onChange={e => {
                        const [hours, minutes] = e.target.value.split(':').map(Number);
                        const newDate = selectedDate || new Date();
                        newDate.setHours(hours);
                        newDate.setMinutes(minutes);
                        setSelectedDate(new Date(newDate));
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-6">
          {tasks.map((task, taskIndex) => <div key={taskIndex} className="space-y-4 p-4 rounded-lg bg-white/50 px-[11px] py-[4px]">
              <div className="space-y-2">
                <Label htmlFor={`task-${taskIndex}`}>Task {taskIndex + 1} Name</Label>
                <div className="flex items-center gap-2">
                  <Input id={`task-${taskIndex}`} value={task.name} onChange={e => handleTaskInputChange(taskIndex, e.target.value)} placeholder={`Enter task ${taskIndex + 1} name`} className="hover-lift flex-grow" required />
                  <Button type="button" variant="ghost" size="icon" onClick={() => addSubtask(taskIndex)} className="flex-shrink-0">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                {loadingTaskIndex === taskIndex ? <p className="text-gray-500">Generating response...</p> : task.subtasks.map((subtask, subtaskIndex) => <div key={subtaskIndex} className="flex items-center gap-2">
                      <Input value={subtask.name} onChange={e => handleSubtaskInputChange(taskIndex, subtaskIndex, e.target.value)} placeholder={`Enter subtask ${subtaskIndex + 1} name`} className="hover-lift" required />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeSubtask(taskIndex, subtaskIndex)} className="flex-shrink-0">
                        <Minus className="h-4 w-4" />
                      </Button>
                    </div>)}
              </div>
            </div>)}
        </div>

        <Button type="submit" className="w-full hover-lift">
          Create Tasks
        </Button>
      </div>
    </form>;
};
